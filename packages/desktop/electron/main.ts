import { app, BrowserWindow, dialog, ipcMain, safeStorage, shell } from "electron";
import { access, copyFile, cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { basename, dirname, join } from "node:path";
import {
  addServer,
  deleteServer,
  discoverLocalMcpServers,
  loadRegistry,
  saveRegistry,
  updateServer,
  type NewMcpServerInput,
  type UpdateMcpServerInput
} from "@mcp-registry/core";
import { nicknameForGitHubLogin } from "../src/githubAuthProfile";
import { getWindowModeSize } from "../src/windowMode";
import {
  detectToolRiskWarnings,
  isToolMarkdown,
  normalizeToolContent,
  parseToolMetadata,
  stripToolMetadata
} from "../src/toolMarkdown";
import { parseToolRuntimeSchema } from "../src/toolSettingsSchema";
import {
  extractTitleBlockCandidates,
  toolExecutionFailureMessage,
  type ToolExecutionRequest,
  type ToolExecutionRequestCommand,
  type ToolExecutionResult
} from "../src/toolExecutionModel";
import {
  assertPathInsideAllowedRoots,
  normalizeAllowedPath
} from "../src/filePathSecurity";
import {
  activeFileProgramForTarget,
  activeFileProbeUrls,
  extractDetectedActiveFiles
} from "../src/activeFileDetection";
import {
  createGithubFlowDocument,
  githubFlowFileName,
  serializeGithubFlowDocument
} from "../src/githubFlowShare";
import type { SavedCustomFlow } from "../src/customFlowLibrary";
import type { OpenDialogOptions } from "electron";
import type { McpServerRecord, McpStatus, RegistryFile } from "@mcp-registry/shared";
import type {
  ProcessLogEntry,
  ProcessSnapshot,
  ProcessState,
  ServerProcessResult
} from "../src/processMonitor";

let mainWindow: BrowserWindow | null = null;

interface CustomToolMetadata {
  name: string;
  description: string;
  version: string;
  author: string;
  sectionId: string;
}

interface GitHubToolSource {
  owner: string;
  repo: string;
  path: string;
  ref?: string;
}

interface GitHubRepository {
  default_branch: string;
  permissions?: {
    push?: boolean;
  };
}

interface GitHubReference {
  object: {
    sha: string;
  };
}

interface GitHubFork {
  owner: {
    login: string;
  };
  full_name: string;
}

interface GitHubPullRequest {
  state: "open" | "closed";
  html_url: string;
  number: number;
  merged_at?: string | null;
}

interface GitHubPublishOptions {
  requireReview: boolean;
}

type GitHubDeleteToolResult =
  | { kind: "deleted" }
  | { kind: "missing" }
  | {
      kind: "pull_request";
      branch: string;
      pullRequestUrl: string;
      pullRequestNumber: number;
      pullRequestState: "open" | "closed" | "merged";
    };

interface GitHubContentItem {
  type: string;
  name: string;
  path: string;
  sha?: string;
  download_url?: string | null;
}

interface GitHubAuthProfile {
  githubId: string;
  nickname: string;
  avatarUrl?: string;
  accessToken?: string;
}

interface GitHubDeviceResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

interface GitHubTokenResponse {
  access_token?: string;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

interface GitHubUserResponse {
  login: string;
  name?: string | null;
  avatar_url?: string | null;
}

function publicAuthProfile(profile: GitHubAuthProfile | null) {
  if (!profile) {
    return null;
  }

  return {
    githubId: profile.githubId,
    nickname: profile.nickname,
    avatarUrl: profile.avatarUrl
  };
}

function approvedCustomToolRootsPath() {
  return join(app.getPath("userData"), "custom-tool-roots.json");
}

let approvedCustomToolRoots: string[] | null = null;

async function loadApprovedCustomToolRoots() {
  if (approvedCustomToolRoots) {
    return approvedCustomToolRoots;
  }

  try {
    const storedRoots = JSON.parse(await readFile(approvedCustomToolRootsPath(), "utf8"));
    approvedCustomToolRoots = Array.isArray(storedRoots)
      ? storedRoots
          .filter((root): root is string => typeof root === "string")
          .map((root) => normalizeAllowedPath(root))
      : [];
  } catch {
    approvedCustomToolRoots = [];
  }

  return approvedCustomToolRoots;
}

async function saveApprovedCustomToolRoots() {
  await mkdir(app.getPath("userData"), { recursive: true });
  await writeFile(
    approvedCustomToolRootsPath(),
    JSON.stringify(await loadApprovedCustomToolRoots(), null, 2),
    "utf8"
  );
}

async function approveCustomToolRoot(rootPath: string) {
  const roots = await loadApprovedCustomToolRoots();
  const normalizedRoot = normalizeAllowedPath(rootPath);
  if (!roots.includes(normalizedRoot)) {
    roots.push(normalizedRoot);
    await saveApprovedCustomToolRoots();
  }
  return normalizedRoot;
}

async function approveCustomToolFile(filePath: string) {
  await approveCustomToolRoot(dirname(filePath));
}

async function assertApprovedCustomToolPath(pathValue: string, label: string) {
  const roots = await loadApprovedCustomToolRoots();
  const builtInToolRoots = [
    join(process.cwd(), "tools"),
    join(app.getAppPath(), "tools"),
    join(process.resourcesPath, "tools")
  ].map((root) => normalizeAllowedPath(root));

  assertPathInsideAllowedRoots(pathValue, [...roots, ...builtInToolRoots], label);
}

async function githubClientId() {
  return (
    process.env.AI_PROGRAM_GITHUB_CLIENT_ID ??
    process.env.VITE_GITHUB_CLIENT_ID ??
    (await readBundledGitHubClientId())
  );
}

function authProfilePath() {
  return join(app.getPath("userData"), "github-auth.json");
}

const encryptedTokenPrefix = "safe:";

function encryptGitHubAccessToken(accessToken?: string) {
  if (!accessToken || accessToken.startsWith(encryptedTokenPrefix)) {
    return accessToken;
  }

  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("GitHub 토큰을 안전하게 저장할 수 없어 로그인을 중단했습니다.");
  }

  return `${encryptedTokenPrefix}${safeStorage.encryptString(accessToken).toString("base64")}`;
}

function decryptGitHubAccessToken(accessToken?: string) {
  if (!accessToken || !accessToken.startsWith(encryptedTokenPrefix)) {
    return accessToken;
  }

  try {
    return safeStorage.decryptString(Buffer.from(accessToken.slice(encryptedTokenPrefix.length), "base64"));
  } catch {
    return undefined;
  }
}

async function loadGitHubAuthProfile(): Promise<GitHubAuthProfile | null> {
  try {
    const profile = JSON.parse(await readFile(authProfilePath(), "utf8")) as GitHubAuthProfile;
    if (profile.accessToken && !profile.accessToken.startsWith(encryptedTokenPrefix)) {
      if (!safeStorage.isEncryptionAvailable()) {
        const profileWithoutUnsafeToken = {
          ...profile,
          accessToken: undefined
        };
        await saveGitHubAuthProfile(profileWithoutUnsafeToken);
        return profileWithoutUnsafeToken;
      }

      await saveGitHubAuthProfile(profile);
    }

    return {
      ...profile,
      accessToken: decryptGitHubAccessToken(profile.accessToken)
    };
  } catch {
    return null;
  }
}

async function saveGitHubAuthProfile(profile: GitHubAuthProfile) {
  await mkdir(app.getPath("userData"), { recursive: true });
  const storedProfile = {
    ...profile,
    accessToken: encryptGitHubAccessToken(profile.accessToken)
  };
  await writeFile(authProfilePath(), JSON.stringify(storedProfile, null, 2), "utf8");
  return publicAuthProfile(profile);
}

async function clearGitHubAuthProfile() {
  try {
    await rm(authProfilePath(), { force: true });
  } catch {
    // Missing auth files are already logged out.
  }
}

async function beginGitHubDeviceLogin() {
  const clientId = await githubClientId();
  if (!clientId) {
    return {
      error:
        "GitHub OAuth App client_id가 설정되지 않았습니다. AI_PROGRAM_GITHUB_CLIENT_ID 환경 변수를 설정해주세요."
    };
  }

  const response = await fetch("https://github.com/login/device/code", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: clientId,
      scope: "read:user repo"
    })
  });

  if (!response.ok) {
    throw new Error(`GitHub device login failed: ${response.status}`);
  }

  const device = (await response.json()) as GitHubDeviceResponse;
  await shell.openExternal(device.verification_uri);
  return {
    deviceCode: device.device_code,
    userCode: device.user_code,
    verificationUri: device.verification_uri,
    expiresIn: device.expires_in,
    interval: device.interval
  };
}

async function pollGitHubDeviceLogin(deviceCode: string, nickname?: string) {
  const clientId = await githubClientId();
  if (!clientId) {
    return { status: "error", message: "GitHub OAuth App client_id가 설정되지 않았습니다." };
  }

  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: clientId,
      device_code: deviceCode,
      grant_type: "urn:ietf:params:oauth:grant-type:device_code"
    })
  });

  if (!response.ok) {
    throw new Error(`GitHub token request failed: ${response.status}`);
  }

  const token = (await response.json()) as GitHubTokenResponse;
  if (token.error) {
    const messages: Record<string, string> = {
      authorization_pending: "아직 GitHub 인증이 완료되지 않았습니다.",
      slow_down: "요청이 너무 빠릅니다. 잠시 후 다시 확인해주세요.",
      expired_token: "인증 시간이 만료되었습니다. 다시 로그인해주세요.",
      access_denied: "GitHub 인증이 취소되었습니다."
    };
    return {
      status: token.error === "authorization_pending" || token.error === "slow_down" ? "pending" : "error",
      message: messages[token.error] ?? token.error_description ?? "GitHub 인증을 완료하지 못했습니다."
    };
  }

  if (!token.access_token) {
    return { status: "error", message: "GitHub access token을 받지 못했습니다." };
  }

  if (!safeStorage.isEncryptionAvailable()) {
    return {
      status: "error",
      message: "이 컴퓨터에서는 GitHub 토큰을 안전하게 저장할 수 없어 로그인을 중단했습니다."
    };
  }

  const userResponse = await fetch("https://api.github.com/user", {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token.access_token}`
    }
  });

  if (!userResponse.ok) {
    throw new Error(`GitHub user request failed: ${userResponse.status}`);
  }

  const user = (await userResponse.json()) as GitHubUserResponse;
  const existingProfile = await loadGitHubAuthProfile();
  const profile: GitHubAuthProfile = {
    githubId: user.login,
    nickname: nicknameForGitHubLogin({
      enteredNickname: nickname,
      existingProfile,
      githubUser: user
    }),
    avatarUrl: user.avatar_url ?? undefined,
    accessToken: token.access_token
  };

  return {
    status: "ok",
    profile: await saveGitHubAuthProfile(profile)
  };
}

async function updateGitHubNickname(nickname: string) {
  const profile = await loadGitHubAuthProfile();
  if (!profile) {
    return null;
  }

  profile.nickname = nickname.trim() || profile.githubId;
  return saveGitHubAuthProfile(profile);
}

async function fetchJsonWithTimeout(url: string, timeoutMs = 800) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal
    });
    if (!response.ok) {
      return null;
    }
    return response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function detectActiveFilesFromMcpServers() {
  const registry = await loadRegistry(registryPath());
  const detectedFiles = [];

  for (const server of registry.servers) {
    const program = activeFileProgramForTarget(server.target);
    if (!program || !server.url) {
      continue;
    }

    for (const url of activeFileProbeUrls(server.url)) {
      const payload = await fetchJsonWithTimeout(url);
      const files = extractDetectedActiveFiles(payload, program, server.id);
      if (files.length > 0) {
        detectedFiles.push(...files);
        break;
      }
    }
  }

  const uniqueFiles = new Map(detectedFiles.map((file) => [file.id, file]));
  return [...uniqueFiles.values()];
}

function mcpCommandTarget(command: ToolExecutionRequestCommand) {
  const server = command.server.toLowerCase();
  if (server.includes("cad") || server.includes("auto")) {
    return "cad";
  }
  if (server.includes("revit")) {
    return "revit";
  }
  if (server.includes("excel")) {
    return "excel";
  }
  if (server.includes("tekla")) {
    return "tekla";
  }
  return server;
}

function mcpBaseUrl(serverUrl: string) {
  try {
    const url = new URL(serverUrl);
    const endpointPath = url.pathname.replace(/\/+$/, "");
    url.pathname = endpointPath.endsWith("/mcp")
      ? endpointPath.slice(0, -"/mcp".length) || "/"
      : endpointPath || "/";
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/+$/, "");
  } catch {
    return serverUrl.replace(/\/+$/, "");
  }
}

async function postJsonWithTimeout(url: string, body: unknown, timeoutMs = 10_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    if (!response.ok) {
      return null;
    }
    return response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function callRegisteredMcpCommand(
  server: McpServerRecord,
  command: ToolExecutionRequestCommand,
  request: ToolExecutionRequest
) {
  if (!server.url) {
    return null;
  }

  const baseUrl = mcpBaseUrl(server.url);
  const payload = {
    command: command.command,
    runtimeAction: request.runtimeAction,
    params: command.params,
    aiInstruction: request.aiInstruction,
    toolName: request.toolName,
    menuName: request.menuName
  };
  const attempts = [
    {
      url: server.url,
      body: {
        jsonrpc: "2.0",
        id: `tool-${Date.now()}`,
        method: "tools/call",
        params: {
          name: command.command,
          arguments: payload
        }
      }
    },
    {
      url: `${baseUrl}/tools/${encodeURIComponent(command.command)}`,
      body: payload
    },
    {
      url: `${baseUrl}/execute`,
      body: payload
    }
  ];

  for (const attempt of attempts) {
    const result = await postJsonWithTimeout(attempt.url, attempt.body);
    if (result) {
      return result;
    }
  }

  return null;
}

async function runToolExecutionRequest(request: ToolExecutionRequest): Promise<ToolExecutionResult> {
  const registry = await loadRegistry(registryPath());
  const runnableCommands = request.commands.filter((command) => command.status !== "manual");

  if (runnableCommands.length === 0) {
    return {
      status: "needs-ai",
      message: "이 툴에는 앱에서 바로 호출할 MCP 명령이 아직 없습니다. MD 툴의 실행 명령 또는 연결된 MCP 브리지를 확인해주세요."
    };
  }

  for (const command of runnableCommands) {
    const target = mcpCommandTarget(command);
    const server = registry.servers.find(
      (candidate) => candidate.target === target || candidate.name.toLowerCase().includes(target)
    );
    if (!server) {
      continue;
    }

    const raw = await callRegisteredMcpCommand(server, command, request);
    if (!raw) {
      continue;
    }

    const failureMessage = toolExecutionFailureMessage({
      status: request.runtimeAction === "preview" ? "preview" : "completed",
      message: "",
      raw
    });
    if (failureMessage) {
      return {
        status: "error",
        message: failureMessage,
        raw: {
          mcp: raw
        }
      };
    }

    const titleBlockCandidates = extractTitleBlockCandidates(raw);
    return {
      status: request.runtimeAction === "preview" ? "preview" : "completed",
      message:
        titleBlockCandidates.length > 0
          ? `${titleBlockCandidates.length}개의 도곽 후보를 CAD MCP에서 받았습니다.`
          : "MCP 응답을 받았습니다. 결과를 확인하세요.",
      raw: {
        mcp: raw
      },
      titleBlockCandidates
    };
  }

  return {
    status: "needs-ai",
    message: "MCP 서버가 실행 요청에 응답하지 않았습니다. 연결된 CAD/Revit/Excel MCP 브리지를 확인해주세요."
  };
}

function contentSimilarity(left: string, right: string) {
  const leftWords = new Set(normalizeToolContent(left).split(" ").filter(Boolean));
  const rightWords = new Set(normalizeToolContent(right).split(" ").filter(Boolean));
  if (leftWords.size === 0 || rightWords.size === 0) {
    return leftWords.size === rightWords.size ? 1 : 0;
  }

  const intersectionSize = [...leftWords].filter((word) => rightWords.has(word)).length;
  return intersectionSize / Math.max(leftWords.size, rightWords.size);
}

function safeFilePart(value: string) {
  return value
    .trim()
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "") || "tool";
}

async function uniqueMarkdownPath(directory: string, metadata: CustomToolMetadata) {
  const baseName = `${safeFilePart(metadata.name)}_${safeFilePart(metadata.version)}`;
  let candidate = join(directory, `${baseName}.md`);
  let suffix = 2;
  while (true) {
    try {
      await access(candidate);
      candidate = join(directory, `${baseName}_${suffix}.md`);
      suffix += 1;
    } catch {
      return candidate;
    }
  }
}

function formatMetadata(metadata: CustomToolMetadata) {
  return [
    "---",
    `toolName: ${JSON.stringify(metadata.name)}`,
    `description: ${JSON.stringify(metadata.description)}`,
    `version: ${JSON.stringify(metadata.version)}`,
    `author: ${JSON.stringify(metadata.author)}`,
    `sectionId: ${JSON.stringify(metadata.sectionId)}`,
    "---",
    ""
  ].join("\n");
}

function markdownWithMetadata(sourceContent: string, metadata: CustomToolMetadata) {
  return `${formatMetadata(metadata)}${stripToolMetadata(sourceContent)}`;
}

async function githubRequest<T>(
  path: string,
  token: string,
  init: RequestInit = {},
  accept = "application/vnd.github+json"
) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: accept,
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.headers ?? {})
    }
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`GitHub request failed: ${response.status} ${message}`);
  }

  return (await response.json()) as T;
}

function githubStatusFromError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const match = message.match(/GitHub request failed: (\d+)/);
  return match ? Number(match[1]) : 0;
}

async function getGitHubContentSha(
  owner: string,
  repo: string,
  targetPath: string,
  branch: string,
  token: string
) {
  try {
    const content = await githubRequest<{ sha: string }>(
      `/repos/${owner}/${repo}/contents/${encodeURIComponent(targetPath).replace(/%2F/g, "/")}?ref=${encodeURIComponent(branch)}`,
      token
    );
    return content.sha;
  } catch (error) {
    if (githubStatusFromError(error) === 404) {
      return null;
    }
    throw error;
  }
}

async function deleteGitHubContentFile({
  owner,
  repo,
  targetPath,
  branch,
  token,
  message,
  retry = true
}: {
  owner: string;
  repo: string;
  targetPath: string;
  branch: string;
  token: string;
  message: string;
  retry?: boolean;
}) {
  const sha = await getGitHubContentSha(owner, repo, targetPath, branch, token);
  if (!sha) {
    return "missing" as const;
  }

  try {
    await githubRequest(
      `/repos/${owner}/${repo}/contents/${encodeURIComponent(targetPath).replace(/%2F/g, "/")}`,
      token,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, sha, branch })
      }
    );
    return "deleted" as const;
  } catch (error) {
    const status = githubStatusFromError(error);
    if (status === 409 && retry) {
      const freshSha = await getGitHubContentSha(owner, repo, targetPath, branch, token);
      if (!freshSha) {
        return "missing" as const;
      }
      await githubRequest(
        `/repos/${owner}/${repo}/contents/${encodeURIComponent(targetPath).replace(/%2F/g, "/")}`,
        token,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message, sha: freshSha, branch })
        }
      );
      return "deleted" as const;
    }
    throw error;
  }
}

async function githubPathExists(owner: string, repo: string, path: string, ref: string, token: string) {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path).replace(/%2F/g, "/")}?ref=${encodeURIComponent(ref)}`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28"
      }
    }
  );

  if (response.status === 404) {
    return false;
  }
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`GitHub path check failed: ${response.status} ${message}`);
  }

  return true;
}

async function waitForGitHubRepository(owner: string, repo: string, token: string) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      return await githubRequest<GitHubRepository>(`/repos/${owner}/${repo}`, token);
    } catch (error) {
      if (attempt === 7) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }
  }

  throw new Error("GitHub fork repository was not ready.");
}

async function createGitHubBranch(
  owner: string,
  repo: string,
  branch: string,
  sha: string,
  token: string
) {
  try {
    await githubRequest(`/repos/${owner}/${repo}/git/refs`, token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ref: `refs/heads/${branch}`,
        sha
      })
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("422") && message.includes("Reference already exists")) {
      return;
    }
    if (message.includes("404")) {
      throw new Error(
        `GitHub 브랜치를 만들 수 없습니다. ${owner}/${repo} 저장소 쓰기 권한 또는 로그인 토큰의 repo 권한을 확인해주세요. (${message})`
      );
    }
    throw error;
  }
}

function githubWritePermissionMessage(owner: string, repo: string) {
  return `${owner}/${repo} 저장소에 쓸 권한이 없습니다. 로그아웃 후 다시 로그인해서 GitHub repo 권한을 승인하거나, 저장소 collaborator 권한을 확인해주세요.`;
}

async function uniqueGitHubToolPath(
  owner: string,
  repo: string,
  directory: string,
  branch: string,
  metadata: CustomToolMetadata,
  token: string
) {
  const baseName = `${safeFilePart(metadata.name)}_${safeFilePart(metadata.version)}`;
  let suffix = 1;

  while (true) {
    const fileName = suffix === 1 ? `${baseName}.md` : `${baseName}_${suffix}.md`;
    const candidate = `${directory.replace(/\/+$/, "")}/${fileName}`;
    if (!(await githubPathExists(owner, repo, candidate, branch, token))) {
      return candidate;
    }
    suffix += 1;
  }
}

function compareToolVersionDesc(left: string, right: string) {
  return right.localeCompare(left, "en", { numeric: true, sensitivity: "base" });
}

async function pruneOldGitHubToolVersions(
  owner: string,
  repo: string,
  directory: string,
  branch: string,
  metadata: CustomToolMetadata,
  token: string,
  currentPath: string
) {
  const directoryPath = directory.replace(/\/+$/, "");
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(directoryPath).replace(/%2F/g, "/")}?ref=${encodeURIComponent(branch)}`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28"
      }
    }
  );

  if (response.status === 404) {
    return;
  }
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`GitHub old tool cleanup failed: ${response.status} ${message}`);
  }

  const entries = (await response.json()) as GitHubContentItem[] | GitHubContentItem;
  const files = (Array.isArray(entries) ? entries : [entries]).filter(
    (entry) => entry.type === "file" && entry.sha && /\.(md|markdown)$/i.test(entry.name) && entry.download_url
  );
  const toolFiles = (
    await Promise.all(
      files.map(async (file) => {
        const contentResponse = await fetch(file.download_url!, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!contentResponse.ok) {
          return null;
        }
        const content = await contentResponse.text();
        const fileMetadata = parseToolMetadata(content) as Partial<CustomToolMetadata> & {
          toolName?: string;
        };
        const name = String(
          fileMetadata.toolName ??
            fileMetadata.name ??
            basename(file.name).replace(/\.(md|markdown)$/i, "")
        );
        const version = String(fileMetadata.version ?? "1.0.0");
        const sectionId = String(fileMetadata.sectionId ?? "servers");

        if (name !== metadata.name || sectionId !== metadata.sectionId) {
          return null;
        }

        return {
          path: file.path,
          sha: file.sha!,
          version
        };
      })
    )
  ).filter((file): file is { path: string; sha: string; version: string } => Boolean(file));

  const sortedFiles = [...toolFiles].sort((left, right) => {
    if (left.path === currentPath) {
      return -1;
    }
    if (right.path === currentPath) {
      return 1;
    }
    return compareToolVersionDesc(left.version, right.version);
  });
  const deleteTargets = sortedFiles.slice(2);

  await Promise.all(
    deleteTargets.map((file) =>
      githubRequest(
        `/repos/${owner}/${repo}/contents/${encodeURIComponent(file.path).replace(/%2F/g, "/")}`,
        token,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: `Prune old ${metadata.name} ${file.version}`,
            sha: file.sha,
            branch
          })
        }
      ).catch((error) => {
        const message = error instanceof Error ? error.message : "";
        if (message.includes("404")) {
          return;
        }
        throw error;
      })
    )
  );
}

async function publishMarkdownToolToGitHub(
  sourcePath: string,
  source: GitHubToolSource,
  metadata: CustomToolMetadata,
  options: GitHubPublishOptions
) {
  const profile = await loadGitHubAuthProfile();
  if (!profile?.accessToken) {
    throw new Error("GitHub 로그인이 필요합니다.");
  }

  const repo = await githubRequest<GitHubRepository>(
    `/repos/${source.owner}/${source.repo}`,
    profile.accessToken
  );
  const canPushToSource = repo.permissions?.push !== false;
  const baseBranch = source.ref ?? repo.default_branch;
  const baseRef = await githubRequest<GitHubReference>(
    `/repos/${source.owner}/${source.repo}/git/ref/heads/${baseBranch}`,
    profile.accessToken
  );
  const content = markdownWithMetadata(await readFile(sourcePath, "utf8"), metadata);

  if (!options.requireReview && canPushToSource) {
    try {
      const targetPath = await uniqueGitHubToolPath(
        source.owner,
        source.repo,
        source.path,
        baseBranch,
        metadata,
        profile.accessToken
      );
      await githubRequest(
        `/repos/${source.owner}/${source.repo}/contents/${encodeURIComponent(targetPath).replace(/%2F/g, "/")}`,
        profile.accessToken,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: `Add ${metadata.name} ${metadata.version}`,
            content: Buffer.from(content, "utf8").toString("base64"),
            branch: baseBranch
          })
        }
      );
      await pruneOldGitHubToolVersions(
        source.owner,
        source.repo,
        source.path,
        baseBranch,
        metadata,
        profile.accessToken,
        targetPath
      );

      return {
        kind: "direct" as const,
        path: `github:${source.owner}/${source.repo}/${targetPath}`,
        branch: baseBranch,
        pullRequestUrl: "",
        pullRequestNumber: 0,
        pullRequestState: "merged" as const
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (!message.includes("403") && !message.includes("404")) {
        throw error;
      }
      // No push permission: fall back to PR so general users can still submit tools.
    }
  }

  if (profile.githubId === source.owner && !canPushToSource) {
    throw new Error(githubWritePermissionMessage(source.owner, source.repo));
  }

  const fork =
    profile.githubId === source.owner
      ? ({ owner: { login: source.owner }, full_name: `${source.owner}/${source.repo}` } as GitHubFork)
      : await githubRequest<GitHubFork>(
          `/repos/${source.owner}/${source.repo}/forks`,
          profile.accessToken,
          { method: "POST" }
        );
  const forkOwner = fork.owner.login;
  const branch = `tool/${safeFilePart(metadata.name)}-${safeFilePart(metadata.version)}-${Date.now()}`;

  if (forkOwner !== source.owner) {
    await waitForGitHubRepository(forkOwner, source.repo, profile.accessToken);
  }

  const forkRepo = await waitForGitHubRepository(forkOwner, source.repo, profile.accessToken);
  const forkBaseBranch = forkRepo.default_branch || baseBranch;
  const forkBaseRef = await githubRequest<GitHubReference>(
    `/repos/${forkOwner}/${source.repo}/git/ref/heads/${forkBaseBranch}`,
    profile.accessToken
  );
  try {
    await createGitHubBranch(
      forkOwner,
      source.repo,
      branch,
      forkBaseRef.object.sha || baseRef.object.sha,
      profile.accessToken
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (profile.githubId === source.owner && message.includes("GitHub 브랜치")) {
      throw new Error(githubWritePermissionMessage(source.owner, source.repo));
    }
    throw error;
  }

  const targetPath = await uniqueGitHubToolPath(
    forkOwner,
    source.repo,
    source.path,
    branch,
    metadata,
    profile.accessToken
  );
  await githubRequest(
    `/repos/${forkOwner}/${source.repo}/contents/${encodeURIComponent(targetPath).replace(/%2F/g, "/")}`,
    profile.accessToken,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `Add ${metadata.name} ${metadata.version}`,
        content: Buffer.from(content, "utf8").toString("base64"),
        branch
      })
    }
  );
  await pruneOldGitHubToolVersions(
    forkOwner,
    source.repo,
    source.path,
    branch,
    metadata,
    profile.accessToken,
    targetPath
  );

  const pullRequest = await githubRequest<GitHubPullRequest>(
    `/repos/${source.owner}/${source.repo}/pulls`,
    profile.accessToken,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `Add tool: ${metadata.name} ${metadata.version}`,
        head: forkOwner === source.owner ? branch : `${forkOwner}:${branch}`,
        base: baseBranch,
        body: [
          `Tool: ${metadata.name}`,
          `Version: ${metadata.version}`,
          `Author: ${metadata.author}`,
          "",
          metadata.description || "No description provided."
        ].join("\n")
      })
    }
  );

  return {
    kind: "pull_request" as const,
    path: `github:${source.owner}/${source.repo}/${targetPath}`,
    branch,
    pullRequestUrl: pullRequest.html_url,
    pullRequestNumber: pullRequest.number,
    pullRequestState: pullRequest.merged_at ? ("merged" as const) : ("open" as const)
  };
}

async function uniqueGitHubFlowPath(
  owner: string,
  repo: string,
  directory: string,
  branch: string,
  flow: SavedCustomFlow,
  token: string
) {
  const baseName = githubFlowFileName(flow).replace(/\.json$/i, "");
  let candidate = `${directory.replace(/\/+$/g, "")}/${baseName}.json`;
  let suffix = 2;
  while (await githubPathExists(owner, repo, candidate, branch, token)) {
    candidate = `${directory.replace(/\/+$/g, "")}/${baseName}_${suffix}.json`;
    suffix += 1;
  }
  return candidate;
}

async function publishSavedFlowToGitHub(
  flow: SavedCustomFlow,
  source: GitHubToolSource,
  options: GitHubPublishOptions
) {
  const profile = await loadGitHubAuthProfile();
  if (!profile?.accessToken) {
    throw new Error("GitHub 로그인이 필요합니다.");
  }

  const repo = await githubRequest<GitHubRepository>(
    `/repos/${source.owner}/${source.repo}`,
    profile.accessToken
  );
  const canPushToSource = repo.permissions?.push !== false;
  const baseBranch = source.ref ?? repo.default_branch;
  const baseRef = await githubRequest<GitHubReference>(
    `/repos/${source.owner}/${source.repo}/git/ref/heads/${baseBranch}`,
    profile.accessToken
  );
  const sharedFlow: SavedCustomFlow = {
    ...flow,
    version: flow.version ?? "1.0.0",
    author: profile.nickname || profile.githubId
  };
  const content = serializeGithubFlowDocument(
    createGithubFlowDocument(sharedFlow, sharedFlow.author)
  );

  if (!options.requireReview && canPushToSource) {
    try {
      const targetPath = await uniqueGitHubFlowPath(
        source.owner,
        source.repo,
        source.path,
        baseBranch,
        sharedFlow,
        profile.accessToken
      );
      await githubRequest(
        `/repos/${source.owner}/${source.repo}/contents/${encodeURIComponent(targetPath).replace(/%2F/g, "/")}`,
        profile.accessToken,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: `Add flow ${sharedFlow.name} ${sharedFlow.version}`,
            content: Buffer.from(content, "utf8").toString("base64"),
            branch: baseBranch
          })
        }
      );
      return {
        kind: "direct" as const,
        path: `github:${source.owner}/${source.repo}/${targetPath}`,
        branch: baseBranch,
        pullRequestUrl: "",
        pullRequestNumber: 0,
        pullRequestState: "merged" as const
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (!message.includes("403") && !message.includes("404")) {
        throw error;
      }
    }
  }

  if (profile.githubId === source.owner && !canPushToSource) {
    throw new Error(githubWritePermissionMessage(source.owner, source.repo));
  }

  const fork =
    profile.githubId === source.owner
      ? ({ owner: { login: source.owner }, full_name: `${source.owner}/${source.repo}` } as GitHubFork)
      : await githubRequest<GitHubFork>(
          `/repos/${source.owner}/${source.repo}/forks`,
          profile.accessToken,
          { method: "POST" }
        );
  const forkOwner = fork.owner.login;
  const branch = `flow/${safeFilePart(sharedFlow.name)}-${safeFilePart(sharedFlow.version ?? "1.0.0")}-${Date.now()}`;

  if (forkOwner !== source.owner) {
    await waitForGitHubRepository(forkOwner, source.repo, profile.accessToken);
  }

  const forkRepo = await waitForGitHubRepository(forkOwner, source.repo, profile.accessToken);
  const forkBaseBranch = forkRepo.default_branch || baseBranch;
  const forkBaseRef = await githubRequest<GitHubReference>(
    `/repos/${forkOwner}/${source.repo}/git/ref/heads/${forkBaseBranch}`,
    profile.accessToken
  );
  await createGitHubBranch(
    forkOwner,
    source.repo,
    branch,
    forkBaseRef.object.sha || baseRef.object.sha,
    profile.accessToken
  );

  const targetPath = await uniqueGitHubFlowPath(
    forkOwner,
    source.repo,
    source.path,
    branch,
    sharedFlow,
    profile.accessToken
  );
  await githubRequest(
    `/repos/${forkOwner}/${source.repo}/contents/${encodeURIComponent(targetPath).replace(/%2F/g, "/")}`,
    profile.accessToken,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `Add flow ${sharedFlow.name} ${sharedFlow.version}`,
        content: Buffer.from(content, "utf8").toString("base64"),
        branch
      })
    }
  );

  const pullRequest = await githubRequest<GitHubPullRequest>(
    `/repos/${source.owner}/${source.repo}/pulls`,
    profile.accessToken,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `Add flow: ${sharedFlow.name} ${sharedFlow.version}`,
        head: forkOwner === source.owner ? branch : `${forkOwner}:${branch}`,
        base: baseBranch,
        body: [
          `Flow: ${sharedFlow.name}`,
          `Version: ${sharedFlow.version}`,
          `Author: ${sharedFlow.author}`,
          "",
          sharedFlow.description || "No description provided."
        ].join("\n")
      })
    }
  );

  return {
    kind: "pull_request" as const,
    path: `github:${source.owner}/${source.repo}/${targetPath}`,
    branch,
    pullRequestUrl: pullRequest.html_url,
    pullRequestNumber: pullRequest.number,
    pullRequestState: pullRequest.merged_at ? ("merged" as const) : ("open" as const)
  };
}

async function listGithubFlows(source: GitHubToolSource): Promise<SavedCustomFlow[]> {
  const ref = source.ref ? `?ref=${encodeURIComponent(source.ref)}` : "";
  const response = await fetch(
    `https://api.github.com/repos/${source.owner}/${source.repo}/contents/${encodeURIComponent(source.path).replace(/%2F/g, "/")}${ref}`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
      }
    }
  );
  if (response.status === 404) {
    return [];
  }
  if (!response.ok) {
    throw new Error(`GitHub flows request failed: ${response.status}`);
  }

  const entries = (await response.json()) as GitHubContentItem[] | GitHubContentItem;
  const files = (Array.isArray(entries) ? entries : [entries]).filter(
    (entry) => entry.type === "file" && entry.name.toLowerCase().endsWith(".json")
  );
  const flows = await Promise.all<SavedCustomFlow | null>(
    files.map(async (entry) => {
      if (!entry.download_url) {
        return null;
      }
      const file = await fetch(entry.download_url);
      if (!file.ok) {
        return null;
      }
      const data = (await file.json()) as Partial<SavedCustomFlow>;
      if (!data.name || !data.graph) {
        return null;
      }
      return {
        id: `github-flow-${safeFilePart(entry.path)}`,
        name: String(data.name),
        description: String(data.description ?? ""),
        version: data.version ? String(data.version) : "1.0.0",
        author: data.author ? String(data.author) : "MCP Registry",
        sourcePath: `github:${source.owner}/${source.repo}/${entry.path}`,
        createdAt: Number(data.createdAt ?? Date.now()),
        updatedAt: Number(data.updatedAt ?? data.createdAt ?? Date.now()),
        graph: data.graph as SavedCustomFlow["graph"]
      } satisfies SavedCustomFlow;
    })
  );

  return flows.filter((flow): flow is SavedCustomFlow => Boolean(flow));
}

async function getGitHubPullRequestState(source: GitHubToolSource, pullRequestNumber: number) {
  const profile = await loadGitHubAuthProfile();
  const token = profile?.accessToken ?? "";
  const pullRequest = await githubRequest<GitHubPullRequest>(
    `/repos/${source.owner}/${source.repo}/pulls/${pullRequestNumber}`,
    token
  );

  return {
    number: pullRequest.number,
    url: pullRequest.html_url,
    state: pullRequest.merged_at ? ("merged" as const) : pullRequest.state,
    mergedAt: pullRequest.merged_at ?? ""
  };
}

async function deleteGitHubToolPath(githubPath: string): Promise<GitHubDeleteToolResult> {
  const prefix = "github:";
  const normalized = githubPath.startsWith(prefix) ? githubPath.slice(prefix.length) : githubPath;
  const [owner, repo, ...pathParts] = normalized.split("/");
  const targetPath = pathParts.join("/");
  if (!owner || !repo || !targetPath) {
    throw new Error("삭제할 GitHub 툴 경로가 올바르지 않습니다.");
  }

  const profile = await loadGitHubAuthProfile();
  if (!profile?.accessToken) {
    throw new Error("GitHub 로그인이 필요합니다.");
  }

  const repoInfo = await githubRequest<GitHubRepository>(
    `/repos/${owner}/${repo}`,
    profile.accessToken
  );
  const baseBranch = repoInfo.default_branch;
  const baseRef = await githubRequest<GitHubReference>(
    `/repos/${owner}/${repo}/git/ref/heads/${baseBranch}`,
    profile.accessToken
  );
  try {
    const deleteResult = await deleteGitHubContentFile({
      owner,
      repo,
      targetPath,
      branch: baseBranch,
      token: profile.accessToken,
      message: `Delete tool ${targetPath}`
    });
    if (deleteResult === "missing") {
      return { kind: "missing" };
    }
    return { kind: "deleted" };
  } catch (error) {
    const status = githubStatusFromError(error);
    if (status !== 403 && status !== 404) {
      throw error;
    }
  }

  if (profile.githubId === owner) {
    throw new Error(githubWritePermissionMessage(owner, repo));
  }

  const fork = await githubRequest<GitHubFork>(
    `/repos/${owner}/${repo}/forks`,
    profile.accessToken,
    { method: "POST" }
  );
  const forkOwner = fork.owner.login;
  await waitForGitHubRepository(forkOwner, repo, profile.accessToken);
  const forkRepo = await waitForGitHubRepository(forkOwner, repo, profile.accessToken);
  const forkBaseBranch = forkRepo.default_branch || baseBranch;
  const forkBaseRef = await githubRequest<GitHubReference>(
    `/repos/${forkOwner}/${repo}/git/ref/heads/${forkBaseBranch}`,
    profile.accessToken
  );
  const branch = `delete-tool/${safeFilePart(basename(targetPath))}-${Date.now()}`;
  await createGitHubBranch(
    forkOwner,
    repo,
    branch,
    forkBaseRef.object.sha || baseRef.object.sha,
    profile.accessToken
  );

  await deleteGitHubContentFile({
    owner: forkOwner,
    repo,
    targetPath,
    branch,
    token: profile.accessToken,
    message: `Delete tool ${targetPath}`
  });

  const pullRequest = await githubRequest<GitHubPullRequest>(
    `/repos/${owner}/${repo}/pulls`,
    profile.accessToken,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `Delete tool: ${basename(targetPath)}`,
        head: `${forkOwner}:${branch}`,
        base: baseBranch,
        body: [`Delete tool file: ${targetPath}`, "", "Requested from AI Program."].join("\n")
      })
    }
  );

  return {
    kind: "pull_request",
    branch,
    pullRequestUrl: pullRequest.html_url,
    pullRequestNumber: pullRequest.number,
    pullRequestState: pullRequest.merged_at ? "merged" : pullRequest.state
  };
}

async function deleteCustomToolFiles(paths: string[]) {
  const uniquePaths = [...new Set(paths.filter(Boolean))];
  const results: {
    path: string;
    status: "deleted" | "skipped" | "failed" | "requested";
    message: string;
    pullRequestUrl?: string;
    pullRequestNumber?: number;
  }[] = [];

  for (const targetPath of uniquePaths) {
    try {
      if (targetPath.startsWith("github:")) {
        const githubDeleteResult = await deleteGitHubToolPath(targetPath);
        results.push({
          path: targetPath,
          status: githubDeleteResult.kind === "pull_request" ? "requested" : "deleted",
          message:
            githubDeleteResult.kind === "missing"
              ? "이미 삭제된 GitHub 원본 파일입니다."
              : githubDeleteResult.kind === "pull_request"
                ? `GitHub 삭제 PR #${githubDeleteResult.pullRequestNumber} 생성`
                : "GitHub 원본 파일 삭제 완료",
          pullRequestUrl:
            githubDeleteResult.kind === "pull_request" ? githubDeleteResult.pullRequestUrl : undefined,
          pullRequestNumber:
            githubDeleteResult.kind === "pull_request" ? githubDeleteResult.pullRequestNumber : undefined
        });
        continue;
      }

      const normalizedTargetPath = normalizeAllowedPath(targetPath);
      try {
        await access(normalizedTargetPath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          results.push({
            path: targetPath,
            status: "deleted",
            message: "이미 삭제된 로컬 원본 파일입니다."
          });
          continue;
        }
        throw error;
      }
      await assertApprovedCustomToolPath(normalizedTargetPath, "삭제할 파일");
      await rm(normalizedTargetPath, { force: true });
      results.push({ path: targetPath, status: "deleted", message: "로컬 원본 파일 삭제 완료" });
    } catch (error) {
      results.push({
        path: targetPath,
        status: "failed",
        message: error instanceof Error ? error.message : "원본 파일 삭제 실패"
      });
    }
  }

  return results;
}

async function rejectGitHubPullRequest(source: GitHubToolSource, pullRequestNumber: number) {
  const profile = await loadGitHubAuthProfile();
  const token = profile?.accessToken ?? "";
  const pullRequest = await githubRequest<GitHubPullRequest>(
    `/repos/${source.owner}/${source.repo}/pulls/${pullRequestNumber}`,
    token,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: "closed" })
    }
  );

  return {
    number: pullRequest.number,
    url: pullRequest.html_url,
    state: pullRequest.merged_at ? ("merged" as const) : pullRequest.state,
    mergedAt: pullRequest.merged_at ?? ""
  };
}

async function getLatestRelease(source: GitHubToolSource) {
  const response = await fetch(`https://api.github.com/repos/${source.owner}/${source.repo}/releases/latest`, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    }
  });

  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`GitHub release request failed: ${response.status} ${message}`);
  }

  const release = (await response.json()) as {
    tag_name: string;
    html_url: string;
    name?: string;
    published_at?: string;
  };

  return {
    tagName: release.tag_name,
    name: release.name ?? release.tag_name,
    url: release.html_url,
    publishedAt: release.published_at ?? ""
  };
}

function registryPath() {
  return process.env.MCP_REGISTRY_PATH ?? join(app.getPath("userData"), "registry.json");
}

interface RunningServerProcess {
  child: ChildProcessWithoutNullStreams;
  server: McpServerRecord;
  startedAt: string;
  lastMessage?: string;
}

const runningServerProcesses = new Map<string, RunningServerProcess>();
const processLogs: ProcessLogEntry[] = [];
const maxProcessLogEntries = 300;

function appendProcessLog(
  server: Pick<McpServerRecord, "id" | "name">,
  level: ProcessLogEntry["level"],
  message: string
) {
  const entry: ProcessLogEntry = {
    id: `${Date.now()}-${processLogs.length}-${Math.random().toString(36).slice(2)}`,
    serverId: server.id,
    serverName: server.name,
    level,
    message: message.trim() || "(빈 로그)",
    createdAt: new Date().toISOString()
  };

  processLogs.push(entry);
  if (processLogs.length > maxProcessLogEntries) {
    processLogs.splice(0, processLogs.length - maxProcessLogEntries);
  }

  const running = runningServerProcesses.get(server.id);
  if (running) {
    running.lastMessage = entry.message;
  }
}

function snapshotFromRegistry(registry: RegistryFile): ProcessSnapshot {
  const processes: ProcessState[] = registry.servers.map((server) => {
    const running = runningServerProcesses.get(server.id);
    return {
      serverId: server.id,
      serverName: server.name,
      target: server.target,
      status: running ? "running" : server.status,
      pid: running?.child.pid,
      startedAt: running?.startedAt,
      lastMessage: running?.lastMessage
    };
  });

  return {
    processes,
    logs: [...processLogs]
  };
}

async function processResult(registry: RegistryFile): Promise<ServerProcessResult> {
  return {
    registry,
    ...snapshotFromRegistry(registry)
  };
}

async function updateServerProcessStatus(serverId: string, status: McpStatus) {
  return updateServer(registryPath(), serverId, { status });
}

async function processSnapshotResult() {
  await ensureUserRegistry();
  return processResult(await loadRegistry(registryPath()));
}

async function startRegisteredServer(serverId: string) {
  await ensureUserRegistry();
  const registry = await loadRegistry(registryPath());
  const server = registry.servers.find((item) => item.id === serverId);
  if (!server) {
    throw new Error("등록된 MCP 서버를 찾을 수 없습니다.");
  }

  if (runningServerProcesses.has(server.id)) {
    appendProcessLog(server, "info", "이미 실행 중입니다.");
    return processResult(await updateServerProcessStatus(server.id, "running"));
  }

  if (!server.launchCommand.trim()) {
    appendProcessLog(server, "error", "실행 명령이 비어 있어 서버를 시작할 수 없습니다.");
    return processResult(await updateServerProcessStatus(server.id, "error"));
  }

  let child: ChildProcessWithoutNullStreams;
  try {
    child = spawn(server.launchCommand, {
      cwd: server.workingDirectory.trim() || undefined,
      env: { ...process.env, ...(server.environment ?? {}) },
      shell: true
    });
  } catch (error) {
    appendProcessLog(server, "error", (error as Error).message);
    return processResult(await updateServerProcessStatus(server.id, "error"));
  }
  const startedAt = new Date().toISOString();
  runningServerProcesses.set(server.id, { child, server, startedAt });
  appendProcessLog(server, "info", `실행 시작: ${server.launchCommand}`);

  child.stdout.on("data", (chunk: Buffer) => {
    appendProcessLog(server, "stdout", chunk.toString("utf8"));
  });

  child.stderr.on("data", (chunk: Buffer) => {
    appendProcessLog(server, "stderr", chunk.toString("utf8"));
  });

  child.on("error", async (error) => {
    runningServerProcesses.delete(server.id);
    appendProcessLog(server, "error", error.message);
    await updateServerProcessStatus(server.id, "error");
  });

  child.on("exit", async (code, signal) => {
    runningServerProcesses.delete(server.id);
    const status: McpStatus = code === 0 || signal === "SIGTERM" ? "stopped" : "error";
    appendProcessLog(
      server,
      status === "error" ? "error" : "info",
      `프로세스 종료: code=${code ?? "null"}, signal=${signal ?? "none"}`
    );
    await updateServerProcessStatus(server.id, status);
  });

  return processResult(await updateServerProcessStatus(server.id, "running"));
}

async function stopRegisteredServer(serverId: string) {
  await ensureUserRegistry();
  const registry = await loadRegistry(registryPath());
  const server = registry.servers.find((item) => item.id === serverId);
  if (!server) {
    throw new Error("등록된 MCP 서버를 찾을 수 없습니다.");
  }

  const running = runningServerProcesses.get(server.id);
  if (!running) {
    appendProcessLog(server, "info", "현재 실행 중인 프로세스가 없습니다.");
    return processResult(await updateServerProcessStatus(server.id, "stopped"));
  }

  appendProcessLog(server, "info", "중지 요청을 보냈습니다.");
  running.child.kill();
  runningServerProcesses.delete(server.id);
  return processResult(await updateServerProcessStatus(server.id, "stopped"));
}

async function findBundledSkillPath(skillName: string) {
  const candidates = [
    join(app.getAppPath(), "assets", "skills", skillName),
    join(__dirname, "..", "assets", "skills", skillName),
    join(process.cwd(), "packages", "desktop", "assets", "skills", skillName)
  ];

  for (const candidate of candidates) {
    try {
      await access(join(candidate, "SKILL.md"));
      return candidate;
    } catch {
      // Try the next development/package location.
    }
  }

  throw new Error(`Bundled ${skillName} skill was not found.`);
}

function assertReadableSkillText(skillName: string, fileName: string, content: string) {
  const brokenEncodingPattern = /�|\?꾩|\?ㅽ|\?묐|\?낅|\?먮|\?대|\?쒕|\?좏|\?곌|\?몃|\?뚯/;
  if (brokenEncodingPattern.test(content)) {
    throw new Error(`${skillName} skill file appears to be corrupted: ${fileName}`);
  }
}

async function assertBundledSkillReadable(skillName: string, sourcePath: string) {
  const filesToCheck = ["SKILL.md", join("references", "ai-program-md-tool.md")];
  for (const fileName of filesToCheck) {
    const filePath = join(sourcePath, fileName);
    try {
      const content = await readFile(filePath, "utf8");
      assertReadableSkillText(skillName, fileName, content);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        continue;
      }
      throw error;
    }
  }
}

async function installBundledSkill(skillName: string) {
  const sourcePath = await findBundledSkillPath(skillName);
  await assertBundledSkillReadable(skillName, sourcePath);
  const targetPath = join(app.getPath("home"), ".codex", "skills", skillName);
  await mkdir(join(app.getPath("home"), ".codex", "skills"), { recursive: true });
  await cp(sourcePath, targetPath, { recursive: true, force: true });
  return { installedPath: targetPath };
}

async function readBundledGitHubClientId() {
  const candidates = [
    join(app.getAppPath(), "data", "github-oauth.json"),
    join(process.cwd(), "data", "github-oauth.json")
  ];

  for (const candidate of candidates) {
    try {
      const config = JSON.parse(await readFile(candidate, "utf8")) as { clientId?: string };
      if (config.clientId?.trim()) {
        return config.clientId.trim();
      }
    } catch {
      // The bundled config is optional; keep looking.
    }
  }

  return "";
}

async function listGithubMarkdownTools(source: GitHubToolSource) {
  const baseUrl = new URL(
    `https://api.github.com/repos/${source.owner}/${source.repo}/contents/${source.path}`
  );
  if (source.ref) {
    baseUrl.searchParams.set("ref", source.ref);
  }

  const response = await fetch(baseUrl, {
    headers: { Accept: "application/vnd.github+json" }
  });
  if (response.status === 404) {
    return [];
  }
  if (!response.ok) {
    throw new Error(`GitHub tools request failed: ${response.status}`);
  }

  const entries = (await response.json()) as GitHubContentItem[] | GitHubContentItem;
  const files = (Array.isArray(entries) ? entries : [entries]).filter(
    (entry) => entry.type === "file" && /\.(md|markdown)$/i.test(entry.name) && entry.download_url
  );

  return Promise.all(
    files.map(async (file) => {
      const contentResponse = await fetch(file.download_url!);
      if (!contentResponse.ok) {
        throw new Error(`GitHub tool download failed: ${file.path}`);
      }
      const content = await contentResponse.text();
      const metadata = parseToolMetadata(content) as Partial<CustomToolMetadata> & {
        toolName?: string;
        learningLog?: unknown;
      };
      const name = String(
        metadata.toolName ?? metadata.name ?? basename(file.name).replace(/\.(md|markdown)$/i, "")
      );
      const version = String(metadata.version ?? "1.0.0");

      return {
        path: `github:${source.owner}/${source.repo}/${file.path}`,
        id: `github:${source.owner}/${source.repo}/${file.path}::${version}`,
        name,
        description: String(metadata.description ?? ""),
        version,
        author: String(metadata.author ?? source.owner),
        sectionId: String(metadata.sectionId ?? "servers"),
        isToolLike: isToolMarkdown(content),
        riskWarnings: detectToolRiskWarnings(content),
        toolSchema: parseToolRuntimeSchema(content),
        learningLog: metadata.learningLog
      };
    })
  );
}

async function ensureUserRegistry() {
  const targetPath = registryPath();
  let exists = true;
  try {
    await access(targetPath);
  } catch {
    exists = false;
    // First run on a different PC: seed user-writable app data from bundled defaults.
  }

  if (!exists) {
    const bundledRegistryPath = join(app.getAppPath(), "data", "registry.json");
    await mkdir(app.getPath("userData"), { recursive: true });
    try {
      await copyFile(bundledRegistryPath, targetPath);
    } catch {
      // Missing bundled data is fine; the registry store will create an empty file on first save.
    }
  }

  await ensureBundledProgramBridgeServers(targetPath);
}

async function ensureBundledProgramBridgeServers(targetPath: string) {
  const bridgeScript = join(
    app.getAppPath(),
    "tools",
    "mcp-bridges",
    "program-bridge",
    "program-mcp-bridge.ps1"
  );
  const bridgeWorkingDirectory = dirname(bridgeScript);
  const now = new Date().toISOString();
  const registry = await loadRegistry(targetPath);
  const definitions: Array<{
    id: string;
    name: string;
    target: McpServerRecord["target"];
    url: string;
    port: number;
    program: string;
    notes: string;
    launchCommand?: string;
    workingDirectory?: string;
  }> = [
    {
      id: "cad-default",
      name: "AutoCAD MCP Bridge",
      target: "cad",
      url: "http://localhost:5100/mcp",
      port: 5100,
      program: "AutoCAD",
      notes: "Local AutoCAD MCP bridge with safe COM read commands for active document, layers, objects, and title block candidates. Commands succeed only when AutoCAD is running."
    },
    {
      id: "revit-default",
      name: "Revit MCP Bridge",
      target: "revit",
      url: "http://localhost:5101/mcp",
      port: 5101,
      program: "Revit",
      launchCommand: "",
      workingDirectory: "",
      notes: "Local Revit MCP add-in bridge. Revit starts this bridge from the Add-Ins tab; AI Program only checks the HTTP endpoint."
    },
    {
      id: "excel-default",
      name: "Excel MCP Bridge",
      target: "excel",
      url: "http://localhost:5200/mcp",
      port: 5200,
      program: "Excel",
      notes: "Local Excel MCP bridge. The process can be detected by AI Program; real Excel workbook commands are the next integration step."
    }
  ];

  let changed = false;
  const servers = [...registry.servers];
  for (const definition of definitions) {
    const launchCommand =
      definition.launchCommand ??
      `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${bridgeScript}" -Program "${definition.program}" -Target "${definition.target}" -Port ${definition.port}`;
    const workingDirectory = definition.workingDirectory ?? bridgeWorkingDirectory;
    const existingIndex = servers.findIndex(
      (server) => server.id === definition.id || server.url === definition.url
    );
    const nextServer: McpServerRecord = {
      id: definition.id,
      name: definition.name,
      target: definition.target,
      connectionType: "http",
      url: definition.url,
      port: definition.port,
      launchCommand,
      workingDirectory,
      environment: {},
      status: "unknown",
      notes: definition.notes,
      createdAt:
        existingIndex >= 0 ? (servers[existingIndex]?.createdAt ?? now) : now,
      updatedAt: now
    };

    if (existingIndex >= 0) {
      const existing = servers[existingIndex];
      const shouldUpdate =
        existing.launchCommand !== nextServer.launchCommand ||
        existing.workingDirectory !== nextServer.workingDirectory ||
        existing.name !== nextServer.name ||
        existing.target !== nextServer.target ||
        existing.notes !== nextServer.notes;
      if (shouldUpdate) {
        servers[existingIndex] = { ...existing, ...nextServer, status: existing.status };
        changed = true;
      }
    } else {
      servers.push(nextServer);
      changed = true;
    }
  }

  if (changed) {
    await saveRegistry(targetPath, { ...registry, servers });
  }
}

function startupLoadingUrl() {
  const html = `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <style>
      html, body { width: 100%; height: 100%; margin: 0; }
      body {
        display: grid;
        place-items: center;
        background: linear-gradient(180deg, #f4f8fd 0%, #eaf3fb 100%);
        color: #172033;
        font-family: "Segoe UI", Arial, sans-serif;
      }
      .panel {
        display: grid;
        justify-items: center;
        gap: 9px;
        min-width: 260px;
        padding: 22px 26px;
        border: 1px solid rgba(201, 211, 225, 0.9);
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.94);
        box-shadow: 0 20px 55px rgba(15, 23, 42, 0.16);
      }
      .spinner {
        width: 26px;
        height: 26px;
        border: 3px solid #d7e2ef;
        border-top-color: #2d5f9f;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }
      strong { font-size: 15px; }
      span { color: #617086; font-size: 12px; }
      @keyframes spin { to { transform: rotate(360deg); } }
    </style>
  </head>
  <body>
    <div class="panel">
      <div class="spinner"></div>
      <strong>MCP 연결관리자 준비 중</strong>
      <span>작업 화면을 불러오고 있습니다.</span>
    </div>
  </body>
</html>`;

  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

function createWindow() {
  const normalSize = getWindowModeSize(false);
  mainWindow = new BrowserWindow({
    width: normalSize.width,
    height: normalSize.height,
    minWidth: 980,
    minHeight: 640,
    show: false,
    backgroundColor: "#eef4fb",
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  });

  const showStartupWindow = () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }

    if (!mainWindow.isVisible()) {
      mainWindow.show();
    }
  };

  let didLoadMainApp = false;
  const loadMainApp = () => {
    if (didLoadMainApp) {
      return;
    }
    didLoadMainApp = true;

    setTimeout(() => {
      if (!mainWindow || mainWindow.isDestroyed()) {
        return;
      }

      if (process.env.VITE_DEV_SERVER_URL) {
        void mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
      } else {
        void mainWindow.loadFile(join(__dirname, "../dist/index.html"));
      }
    }, 120);
  };

  mainWindow.once("ready-to-show", () => {
    showStartupWindow();
    loadMainApp();
  });

  void mainWindow
    .loadURL(startupLoadingUrl())
    .then(() => {
      showStartupWindow();
      loadMainApp();
    })
    .catch(() => {
      showStartupWindow();
      loadMainApp();
    });
}

ipcMain.handle("window:set-compact-mode", (_event, enabled: boolean) => {
  if (!mainWindow) {
    return;
  }

  const size = getWindowModeSize(enabled);
  mainWindow.setMinimumSize(enabled ? 520 : 980, enabled ? 660 : 640);
  mainWindow.setSize(size.width, size.height, true);
});

ipcMain.handle("window:open-web-view", async () => {
  const targetUrl =
    process.env.VITE_DEV_SERVER_URL ?? `file://${join(__dirname, "../dist/index.html")}`;
  await shell.openExternal(targetUrl);
});

ipcMain.handle("skills:install-save-tool", async () => installBundledSkill("save-tool"));
ipcMain.handle("skills:install-mcp-tool-builder", async () =>
  installBundledSkill("mcp-tool-builder")
);
ipcMain.handle("skills:install-program-mcp-registrar", async () =>
  installBundledSkill("program-mcp-registrar")
);

ipcMain.handle("github-auth:get-profile", async () =>
  publicAuthProfile(await loadGitHubAuthProfile())
);

ipcMain.handle("github-auth:begin-login", async () => beginGitHubDeviceLogin());

ipcMain.handle("github-auth:poll-login", async (_event, deviceCode: string, nickname?: string) =>
  pollGitHubDeviceLogin(deviceCode, nickname)
);

ipcMain.handle("github-auth:update-nickname", async (_event, nickname: string) =>
  updateGitHubNickname(nickname)
);

ipcMain.handle("github-auth:logout", async () => {
  await clearGitHubAuthProfile();
  return null;
});

ipcMain.handle("active-files:detect", async () => detectActiveFilesFromMcpServers());

ipcMain.handle("tool-execution:run", async (_event, request: ToolExecutionRequest) =>
  runToolExecutionRequest(request)
);

ipcMain.handle("custom-flows:list-github-flows", async (_event, source: GitHubToolSource) =>
  listGithubFlows(source)
);

ipcMain.handle("custom-flows:delete-github-flow", async (_event, githubPath: string) =>
  deleteGitHubToolPath(githubPath)
);

ipcMain.handle(
  "custom-flows:publish-github-flow",
  async (
    _event,
    flow: SavedCustomFlow,
    source: GitHubToolSource,
    options: GitHubPublishOptions
  ) => publishSavedFlowToGitHub(flow, source, options)
);

ipcMain.handle("custom-tools:choose-directory", async () => {
  const options: OpenDialogOptions = {
    properties: ["openDirectory", "createDirectory"]
  };
  const result = mainWindow
    ? await dialog.showOpenDialog(mainWindow, options)
    : await dialog.showOpenDialog(options);

  if (result.canceled || !result.filePaths[0]) {
    return null;
  }

  await approveCustomToolRoot(result.filePaths[0]);
  return result.filePaths[0];
});

ipcMain.handle("custom-tools:choose-md-file", async () => {
  const options: OpenDialogOptions = {
    properties: ["openFile"],
    filters: [{ name: "Markdown", extensions: ["md", "markdown"] }]
  };
  const result = mainWindow
    ? await dialog.showOpenDialog(mainWindow, options)
    : await dialog.showOpenDialog(options);

  if (result.canceled || !result.filePaths[0]) {
    return null;
  }

  const filePath = result.filePaths[0];
  await approveCustomToolFile(filePath);
  const content = await readFile(filePath, "utf8");
  const metadata = parseToolMetadata(content) as Partial<CustomToolMetadata> & {
    toolName?: string;
    learningLog?: unknown;
  };
  const name = String(metadata.toolName ?? metadata.name ?? basename(filePath).replace(/\.(md|markdown)$/i, ""));
  return {
    path: filePath,
    name,
    description: String(metadata.description ?? ""),
    preview: content.slice(0, 4000),
    isToolLike: isToolMarkdown(content),
    riskWarnings: detectToolRiskWarnings(content),
    toolSchema: parseToolRuntimeSchema(content),
    learningLog: metadata.learningLog
  };
});

ipcMain.handle("custom-tools:list-md-files", async (_event, directory: string) => {
  await assertApprovedCustomToolPath(directory, "폴더");
  const entries = await readdir(directory, { withFileTypes: true });
  const files = entries.filter(
    (entry) => entry.isFile() && /\.(md|markdown)$/i.test(entry.name)
  );

  return Promise.all(
    files.map(async (file) => {
      const filePath = join(directory, file.name);
      const content = await readFile(filePath, "utf8");
      const metadata = parseToolMetadata(content) as Partial<CustomToolMetadata> & {
        toolName?: string;
        learningLog?: unknown;
      };
      const name = String(metadata.toolName ?? metadata.name ?? basename(file.name).replace(/\.(md|markdown)$/i, ""));
      const version = String(metadata.version ?? "1.0.0");
      return {
        path: filePath,
        id: `${name}::${version}`,
        name,
        description: String(metadata.description ?? ""),
        version,
        author: String(metadata.author ?? "Unknown"),
        sectionId: String(metadata.sectionId ?? "servers"),
        isToolLike: isToolMarkdown(content),
        riskWarnings: detectToolRiskWarnings(content),
        toolSchema: parseToolRuntimeSchema(content),
        learningLog: metadata.learningLog
      };
    })
  );
});

ipcMain.handle("custom-tools:list-github-tools", async (_event, source: GitHubToolSource) =>
  listGithubMarkdownTools(source)
);

ipcMain.handle(
  "custom-tools:publish-github-tool",
  async (
    _event,
    sourcePath: string,
    source: GitHubToolSource,
    metadata: CustomToolMetadata,
    options: GitHubPublishOptions
  ) => {
    await assertApprovedCustomToolPath(sourcePath, "MD 파일");
    return publishMarkdownToolToGitHub(sourcePath, source, metadata, options);
  }
);

ipcMain.handle(
  "custom-tools:get-pr-state",
  async (_event, source: GitHubToolSource, pullRequestNumber: number) =>
    getGitHubPullRequestState(source, pullRequestNumber)
);

ipcMain.handle(
  "custom-tools:reject-pr",
  async (_event, source: GitHubToolSource, pullRequestNumber: number) =>
    rejectGitHubPullRequest(source, pullRequestNumber)
);

ipcMain.handle("custom-tools:delete-tool-files", async (_event, paths: string[]) =>
  deleteCustomToolFiles(paths)
);

ipcMain.handle("app-updates:get-latest-release", async (_event, source: GitHubToolSource) =>
  getLatestRelease(source)
);

ipcMain.handle(
  "custom-tools:copy-md-file",
  async (
    _event,
    sourcePath: string,
    targetDirectory: string,
    metadata?: CustomToolMetadata
  ) => {
    await assertApprovedCustomToolPath(sourcePath, "원본 MD 파일");
    await assertApprovedCustomToolPath(targetDirectory, "저장할 폴더");
    await mkdir(targetDirectory, { recursive: true });
    const targetPath = metadata
      ? await uniqueMarkdownPath(targetDirectory, metadata)
      : join(targetDirectory, basename(sourcePath));
    if (metadata) {
      const content = await readFile(sourcePath, "utf8");
      await writeFile(targetPath, `${formatMetadata(metadata)}${stripToolMetadata(content)}`, "utf8");
    } else {
      await copyFile(sourcePath, targetPath);
    }
    return targetPath;
  }
);

ipcMain.handle("custom-tools:compare-md-file", async (_event, leftPath: string, rightPath: string) => {
  await assertApprovedCustomToolPath(leftPath, "기존 MD 파일");
  await assertApprovedCustomToolPath(rightPath, "새 MD 파일");
  const [leftContent, rightContent] = await Promise.all([
    readFile(leftPath, "utf8"),
    readFile(rightPath, "utf8")
  ]);
  const similarity = contentSimilarity(leftContent, rightContent);
  return {
    similar: similarity >= 0.35,
    similarity
  };
});

ipcMain.handle("registry:load", async () => {
  await ensureUserRegistry();
  return loadRegistry(registryPath());
});

ipcMain.handle("registry:add-server", (_event, input: NewMcpServerInput) =>
  addServer(registryPath(), input)
);

ipcMain.handle(
  "registry:update-server",
  (_event, id: string, input: UpdateMcpServerInput) => updateServer(registryPath(), id, input)
);

ipcMain.handle("registry:delete-server", (_event, id: string) =>
  deleteServer(registryPath(), id)
);

ipcMain.handle("registry:auto-add-servers", async () => {
  await ensureUserRegistry();
  const registry = await loadRegistry(registryPath());
  const discovered = await discoverLocalMcpServers(registry);
  const now = new Date().toISOString();
  const servers = [
    ...registry.servers,
    ...discovered.map((input) => ({
      ...input,
      id: crypto.randomUUID(),
      status: "running" as const,
      createdAt: now,
      updatedAt: now
    }))
  ];
  const next = { ...registry, servers };
  await saveRegistry(registryPath(), next);
  return next;
});

ipcMain.handle("mcp-processes:get-snapshot", async () => processSnapshotResult());

ipcMain.handle("mcp-processes:start-server", async (_event, serverId: string) =>
  startRegisteredServer(serverId)
);

ipcMain.handle("mcp-processes:stop-server", async (_event, serverId: string) =>
  stopRegisteredServer(serverId)
);

void app.whenReady().then(createWindow);

app.on("before-quit", () => {
  for (const running of runningServerProcesses.values()) {
    running.child.kill();
  }
  runningServerProcesses.clear();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
