import type { RegistryFile } from "@mcp-registry/shared";
import type { NewMcpServerInput, UpdateMcpServerInput } from "@mcp-registry/core";
import type { ServerProcessResult } from "./processMonitor";
import type { ToolRuntimeSchema } from "./toolSettingsSchema";
import type { ToolExecutionRequest, ToolExecutionResult } from "./toolExecutionModel";
import type { SavedCustomFlow } from "./customFlowLibrary";

declare global {
  interface Window {
    mcpRegistry?: {
      loadRegistry: () => Promise<RegistryFile>;
      addServer: (input: NewMcpServerInput) => Promise<RegistryFile>;
      updateServer: (id: string, input: UpdateMcpServerInput) => Promise<RegistryFile>;
      deleteServer: (id: string) => Promise<RegistryFile>;
      autoAddServers: () => Promise<RegistryFile>;
    };
    mcpWindow?: {
      setCompactMode: (enabled: boolean) => Promise<void>;
      openWebView: () => Promise<void>;
    };
    mcpProcesses?: {
      getSnapshot: () => Promise<ServerProcessResult>;
      startServer: (serverId: string) => Promise<ServerProcessResult>;
      stopServer: (serverId: string) => Promise<ServerProcessResult>;
    };
    toolExecution?: {
      run: (request: ToolExecutionRequest) => Promise<ToolExecutionResult>;
    };
    customFlows?: {
      listGithubFlows: (source: {
        owner: string;
        repo: string;
        path: string;
        ref?: string;
      }) => Promise<SavedCustomFlow[]>;
      deleteGithubFlow: (githubPath: string) => Promise<{
        kind: "deleted" | "missing" | "pull_request";
        branch?: string;
        pullRequestUrl?: string;
        pullRequestNumber?: number;
        pullRequestState?: "open" | "closed" | "merged";
      }>;
      publishGithubFlow: (
        flow: SavedCustomFlow,
        source: {
          owner: string;
          repo: string;
          path: string;
          ref?: string;
        },
        options: { requireReview: boolean }
      ) => Promise<{
        kind: "direct" | "pull_request";
        path: string;
        branch: string;
        pullRequestUrl: string;
        pullRequestNumber: number;
        pullRequestState: "open" | "closed" | "merged";
      }>;
    };
    skillInstaller?: {
      installSaveTool: () => Promise<{ installedPath: string }>;
      installMcpToolBuilder: () => Promise<{ installedPath: string }>;
      installProgramMcpRegistrar: () => Promise<{ installedPath: string }>;
    };
    activeFiles?: {
      detect: () => Promise<
        {
          id: string;
          label: string;
          program: "cad" | "revit" | "excel" | "tekla";
          path: string;
        }[]
      >;
    };
    githubAuth?: {
      getProfile: () => Promise<{
        githubId: string;
        nickname: string;
        avatarUrl?: string;
      } | null>;
      beginLogin: () => Promise<
        | {
            deviceCode: string;
            userCode: string;
            verificationUri: string;
            expiresIn: number;
            interval: number;
          }
        | { error: string }
      >;
      pollLogin: (
        deviceCode: string,
        nickname?: string
      ) => Promise<
        | {
            status: "ok";
            profile: {
              githubId: string;
              nickname: string;
              avatarUrl?: string;
            };
          }
        | { status: "pending" | "error"; message: string }
      >;
      updateNickname: (nickname: string) => Promise<{
        githubId: string;
        nickname: string;
        avatarUrl?: string;
      } | null>;
      logout: () => Promise<null>;
    };
    customTools?: {
      chooseDirectory: () => Promise<string | null>;
      chooseMarkdownFile: () => Promise<{
        path: string;
        name: string;
        description: string;
        preview: string;
        isToolLike: boolean;
        riskWarnings: string[];
        toolSchema: ToolRuntimeSchema;
        learningLog?: unknown;
      } | null>;
      listMarkdownTools: (directory: string) => Promise<
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
          toolSchema: ToolRuntimeSchema;
          learningLog?: unknown;
        }[]
      >;
      listGithubTools: (source: {
        owner: string;
        repo: string;
        path: string;
        ref?: string;
      }) => Promise<
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
          toolSchema: ToolRuntimeSchema;
          learningLog?: unknown;
        }[]
      >;
      publishGithubTool: (
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
      ) => Promise<{
        kind: "direct" | "pull_request";
        path: string;
        branch: string;
        pullRequestUrl: string;
        pullRequestNumber: number;
        pullRequestState: "open" | "closed" | "merged";
      }>;
      getPullRequestState: (
        source: {
          owner: string;
          repo: string;
          path: string;
          ref?: string;
        },
        pullRequestNumber: number
      ) => Promise<{
        number: number;
        url: string;
        state: "open" | "closed" | "merged";
        mergedAt: string;
      }>;
      rejectPullRequest: (
        source: {
          owner: string;
          repo: string;
          path: string;
          ref?: string;
        },
        pullRequestNumber: number
      ) => Promise<{
        number: number;
        url: string;
        state: "open" | "closed" | "merged";
        mergedAt: string;
      }>;
      deleteToolFiles: (
        paths: string[]
      ) => Promise<
        {
          path: string;
          status: "deleted" | "skipped" | "failed" | "requested";
          message: string;
          pullRequestUrl?: string;
          pullRequestNumber?: number;
        }[]
      >;
      copyMarkdownFile: (
        sourcePath: string,
        targetDirectory: string,
        metadata?: {
          name: string;
          description: string;
          version: string;
          author: string;
          sectionId: string;
        }
      ) => Promise<string>;
      compareMarkdownFile: (
        leftPath: string,
        rightPath: string
      ) => Promise<{ similar: boolean; similarity: number }>;
    };
    appUpdates?: {
      getLatestRelease: (source: {
        owner: string;
        repo: string;
        path: string;
        ref?: string;
      }) => Promise<{
        tagName: string;
        name: string;
        url: string;
        publishedAt: string;
      } | null>;
    };
  }
}
