import { app, BrowserWindow, dialog, ipcMain, safeStorage, shell } from "electron";
import { access, copyFile, cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { basename, join } from "node:path";
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

interface GitHubContentItem {
  type: string;
  name: string;
  path: string;
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
    return accessToken;
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
        scope: "read:user public_repo"
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

function parseMetadata(content: string) {
  if (!content.startsWith("---")) {
    return {};
  }

  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) {
    return {};
  }

  return Object.fromEntries(
    match[1]
      .split(/\r?\n/)
      .map((line) => line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/))
      .filter((item): item is RegExpMatchArray => Boolean(item))
      .map((item) => {
        const rawValue = item[2].trim();
        try {
          return [item[1], JSON.parse(rawValue)];
        } catch {
          return [item[1], rawValue.replace(/^["']|["']$/g, "")];
        }
      })
  );
}

function stripMetadata(content: string) {
  return content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
}

function normalizeContent(content: string) {
  return stripMetadata(content)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}_ -]/gu, "")
    .trim();
}

function contentSimilarity(left: string, right: string) {
  const leftWords = new Set(normalizeContent(left).split(" ").filter(Boolean));
  const rightWords = new Set(normalizeContent(right).split(" ").filter(Boolean));
  if (leftWords.size === 0 || rightWords.size === 0) {
    return leftWords.size === rightWords.size ? 1 : 0;
  }

  const intersectionSize = [...leftWords].filter((word) => rightWords.has(word)).length;
  return intersectionSize / Math.max(leftWords.size, rightWords.size);
}

function isToolMarkdown(content: string) {
  const metadata = parseMetadata(content) as Record<string, unknown>;
  const normalized = normalizeContent(content);
  const metadataSignals = [
    metadata.toolName,
    metadata.name,
    metadata.version,
    metadata.author,
    metadata.sectionId
  ].filter(Boolean).length;
  const bodySignals = [
    /\btool\b/i,
    /\bcommand\b/i,
    /\bparameters?\b/i,
    /\binputs?\b/i,
    /\boutputs?\b/i,
    /\busage\b/i,
    /사용법|입력|출력|명령|실행|파라미터|도구|툴/
  ].filter((pattern) => pattern.test(normalized)).length;

  return metadataSignals >= 2 || bodySignals >= 2;
}

function detectToolRiskWarnings(content: string) {
  const normalized = normalizeContent(content);
  const destructiveActionPattern =
    /\b(delete|remove|erase|purge|destroy|wipe|clear)\b|삭제|제거|지우|소거|정리/;
  const creationActionPattern =
    /\b(create|add|insert|generate|make|place|draw)\b|생성|추가|삽입|배치|작성|그리/;
  const modelObjectPattern =
    /\b(object|objects|element|elements|entity|entities|block|blocks|family|families|wall|walls|layer|layers|model|geometry)\b|객체|요소|블록|패밀리|벽|레이어|모델|형상|도면|부재/;
  const commandPattern =
    /\b(command|execute|run|operation|action|tool)\b|명령|실행|작업|동작|툴|도구/;
  const reasons: string[] = [];

  if (destructiveActionPattern.test(normalized) && modelObjectPattern.test(normalized)) {
    reasons.push("MD 내용에서 모델 객체나 요소를 삭제/제거할 수 있는 동작이 감지되었습니다.");
  }

  if (
    creationActionPattern.test(normalized) &&
    modelObjectPattern.test(normalized) &&
    commandPattern.test(normalized)
  ) {
    reasons.push("MD 내용에서 모델 객체나 요소를 새로 생성/추가할 수 있는 동작이 감지되었습니다.");
  }

  return reasons;
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
  return `${formatMetadata(metadata)}${stripMetadata(sourceContent)}`;
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
  const baseBranch = source.ref ?? repo.default_branch;
  const baseRef = await githubRequest<GitHubReference>(
    `/repos/${source.owner}/${source.repo}/git/ref/heads/${baseBranch}`,
    profile.accessToken
  );
  const content = markdownWithMetadata(await readFile(sourcePath, "utf8"), metadata);

  if (!options.requireReview) {
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

  await githubRequest(
    `/repos/${forkOwner}/${source.repo}/git/refs`,
    profile.accessToken,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ref: `refs/heads/${branch}`,
        sha: baseRef.object.sha
      })
    }
  );

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
    appendProcessLog(server, "info", "앱에서 실행 중인 프로세스가 없습니다.");
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

async function installBundledSkill(skillName: string) {
  const sourcePath = await findBundledSkillPath(skillName);
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
      const metadata = parseMetadata(content) as Partial<CustomToolMetadata> & {
        toolName?: string;
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
        riskWarnings: detectToolRiskWarnings(content)
      };
    })
  );
}

async function ensureUserRegistry() {
  const targetPath = registryPath();
  try {
    await access(targetPath);
    return;
  } catch {
    // First run on a different PC: seed user-writable app data from bundled defaults.
  }

  const bundledRegistryPath = join(app.getAppPath(), "data", "registry.json");
  await mkdir(app.getPath("userData"), { recursive: true });
  try {
    await copyFile(bundledRegistryPath, targetPath);
  } catch {
    // Missing bundled data is fine; the registry store will create an empty file on first save.
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
      <strong>MCP 연결 관리자 준비 중</strong>
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
      preload: join(__dirname, "preload.cjs")
    }
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
    setTimeout(() => {
      if (!mainWindow) {
        return;
      }

      if (process.env.VITE_DEV_SERVER_URL) {
        void mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
      } else {
        void mainWindow.loadFile(join(__dirname, "../dist/index.html"));
      }
    }, 120);
  });

  void mainWindow.loadURL(startupLoadingUrl());
}

ipcMain.handle("window:set-compact-mode", (_event, enabled: boolean) => {
  if (!mainWindow) {
    return;
  }

  const size = getWindowModeSize(enabled);
  mainWindow.setMinimumSize(enabled ? 390 : 980, enabled ? 640 : 640);
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

ipcMain.handle("custom-tools:choose-directory", async () => {
  const options: OpenDialogOptions = {
    properties: ["openDirectory", "createDirectory"]
  };
  const result = mainWindow
    ? await dialog.showOpenDialog(mainWindow, options)
    : await dialog.showOpenDialog(options);

  return result.canceled ? null : result.filePaths[0];
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
  const content = await readFile(filePath, "utf8");
  return {
    path: filePath,
    name: basename(filePath).replace(/\.(md|markdown)$/i, ""),
    preview: content.slice(0, 4000),
    isToolLike: isToolMarkdown(content),
    riskWarnings: detectToolRiskWarnings(content)
  };
});

ipcMain.handle("custom-tools:list-md-files", async (_event, directory: string) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = entries.filter(
    (entry) => entry.isFile() && /\.(md|markdown)$/i.test(entry.name)
  );

  return Promise.all(
    files.map(async (file) => {
      const filePath = join(directory, file.name);
      const content = await readFile(filePath, "utf8");
      const metadata = parseMetadata(content) as Partial<CustomToolMetadata> & {
        toolName?: string;
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
        riskWarnings: detectToolRiskWarnings(content)
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
  ) => publishMarkdownToolToGitHub(sourcePath, source, metadata, options)
);

ipcMain.handle(
  "custom-tools:get-pr-state",
  async (_event, source: GitHubToolSource, pullRequestNumber: number) =>
    getGitHubPullRequestState(source, pullRequestNumber)
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
  await mkdir(targetDirectory, { recursive: true });
  const targetPath = metadata
    ? await uniqueMarkdownPath(targetDirectory, metadata)
    : join(targetDirectory, basename(sourcePath));
  if (metadata) {
    const content = await readFile(sourcePath, "utf8");
    await writeFile(targetPath, `${formatMetadata(metadata)}${stripMetadata(content)}`, "utf8");
  } else {
    await copyFile(sourcePath, targetPath);
  }
  return targetPath;
  }
);

ipcMain.handle("custom-tools:compare-md-file", async (_event, leftPath: string, rightPath: string) => {
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
