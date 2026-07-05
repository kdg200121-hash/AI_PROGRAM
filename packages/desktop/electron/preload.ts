import { contextBridge, ipcRenderer } from "electron";
import type { RegistryFile } from "@mcp-registry/shared";
import type { NewMcpServerInput, UpdateMcpServerInput } from "@mcp-registry/core";

contextBridge.exposeInMainWorld("mcpRegistry", {
  loadRegistry: async () => ipcRenderer.invoke("registry:load") as Promise<RegistryFile>,
  addServer: async (input: NewMcpServerInput) =>
    ipcRenderer.invoke("registry:add-server", input) as Promise<RegistryFile>,
  updateServer: async (id: string, input: UpdateMcpServerInput) =>
    ipcRenderer.invoke("registry:update-server", id, input) as Promise<RegistryFile>,
  deleteServer: async (id: string) =>
    ipcRenderer.invoke("registry:delete-server", id) as Promise<RegistryFile>,
  autoAddServers: async () =>
    ipcRenderer.invoke("registry:auto-add-servers") as Promise<RegistryFile>
});

contextBridge.exposeInMainWorld("mcpWindow", {
  setCompactMode: async (enabled: boolean) => {
    await ipcRenderer.invoke("window:set-compact-mode", enabled);
  },
  openWebView: async () => {
    await ipcRenderer.invoke("window:open-web-view");
  }
});

contextBridge.exposeInMainWorld("skillInstaller", {
  installSaveTool: async () =>
    ipcRenderer.invoke("skills:install-save-tool") as Promise<{ installedPath: string }>,
  installMcpToolBuilder: async () =>
    ipcRenderer.invoke("skills:install-mcp-tool-builder") as Promise<{ installedPath: string }>
});

contextBridge.exposeInMainWorld("githubAuth", {
  getProfile: async () =>
    ipcRenderer.invoke("github-auth:get-profile") as Promise<{
      githubId: string;
      nickname: string;
      avatarUrl?: string;
    } | null>,
  beginLogin: async () =>
    ipcRenderer.invoke("github-auth:begin-login") as Promise<
      | {
          deviceCode: string;
          userCode: string;
          verificationUri: string;
          expiresIn: number;
          interval: number;
        }
      | { error: string }
    >,
  pollLogin: async (deviceCode: string, nickname?: string) =>
    ipcRenderer.invoke("github-auth:poll-login", deviceCode, nickname) as Promise<
      | {
          status: "ok";
          profile: {
            githubId: string;
            nickname: string;
            avatarUrl?: string;
          };
        }
      | { status: "pending" | "error"; message: string }
    >,
  updateNickname: async (nickname: string) =>
    ipcRenderer.invoke("github-auth:update-nickname", nickname) as Promise<{
      githubId: string;
      nickname: string;
      avatarUrl?: string;
    } | null>,
  logout: async () => ipcRenderer.invoke("github-auth:logout") as Promise<null>
});

contextBridge.exposeInMainWorld("customTools", {
  chooseDirectory: async () =>
    ipcRenderer.invoke("custom-tools:choose-directory") as Promise<string | null>,
  chooseMarkdownFile: async () =>
    ipcRenderer.invoke("custom-tools:choose-md-file") as Promise<{
      path: string;
      name: string;
      preview: string;
      isToolLike: boolean;
      riskWarnings: string[];
    } | null>,
  listMarkdownTools: async (directory: string) =>
    ipcRenderer.invoke("custom-tools:list-md-files", directory) as Promise<
      {
        path: string;
        id: string;
        name: string;
        description: string;
        version: string;
        author: string;
        sectionId: string;
        isToolLike: boolean;
        riskWarnings: string[];
      }[]
    >,
  listGithubTools: async (source: {
    owner: string;
    repo: string;
    path: string;
    ref?: string;
  }) =>
    ipcRenderer.invoke("custom-tools:list-github-tools", source) as Promise<
      {
        path: string;
        id: string;
        name: string;
        description: string;
        version: string;
        author: string;
        sectionId: string;
        isToolLike: boolean;
        riskWarnings: string[];
      }[]
    >,
  publishGithubTool: async (
    sourcePath: string,
    source: {
      owner: string;
      repo: string;
      path: string;
      ref?: string;
    },
    metadata: {
      name: string;
      description: string;
      version: string;
      author: string;
      sectionId: string;
    },
    options: {
      requireReview: boolean;
    }
  ) =>
    ipcRenderer.invoke(
      "custom-tools:publish-github-tool",
      sourcePath,
      source,
      metadata,
      options
    ) as Promise<{
      kind: "direct" | "pull_request";
      path: string;
      branch: string;
      pullRequestUrl: string;
      pullRequestNumber: number;
      pullRequestState: "open" | "closed" | "merged";
    }>,
  getPullRequestState: async (
    source: {
      owner: string;
      repo: string;
      path: string;
      ref?: string;
    },
    pullRequestNumber: number
  ) =>
    ipcRenderer.invoke("custom-tools:get-pr-state", source, pullRequestNumber) as Promise<{
      number: number;
      url: string;
      state: "open" | "closed" | "merged";
      mergedAt: string;
    }>,
  copyMarkdownFile: async (
    sourcePath: string,
    targetDirectory: string,
    metadata?: {
      name: string;
      description: string;
      version: string;
      author: string;
      sectionId: string;
    }
  ) =>
    ipcRenderer.invoke(
      "custom-tools:copy-md-file",
      sourcePath,
      targetDirectory,
      metadata
    ) as Promise<string>,
  compareMarkdownFile: async (leftPath: string, rightPath: string) =>
    ipcRenderer.invoke("custom-tools:compare-md-file", leftPath, rightPath) as Promise<{
      similar: boolean;
      similarity: number;
    }>
});

contextBridge.exposeInMainWorld("appUpdates", {
  getLatestRelease: async (source: {
    owner: string;
    repo: string;
    path: string;
    ref?: string;
  }) =>
    ipcRenderer.invoke("app-updates:get-latest-release", source) as Promise<{
      tagName: string;
      name: string;
      url: string;
      publishedAt: string;
    } | null>
});
