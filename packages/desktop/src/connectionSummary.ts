import type { McpServerRecord } from "@mcp-registry/shared";

export type ConnectionSummaryTone = "online" | "offline";

export interface ConnectionSummary {
  tone: ConnectionSummaryTone;
  label: string;
}

export function getConnectionSummary(servers: McpServerRecord[]): ConnectionSummary {
  if (servers.length === 0) {
    return { tone: "offline", label: "연결 없음" };
  }

  const runningCount = servers.filter((server) => server.status === "running").length;

  if (runningCount === servers.length) {
    return { tone: "online", label: "MCP 연결됨" };
  }

  return { tone: "offline", label: "MCP 미연결" };
}
