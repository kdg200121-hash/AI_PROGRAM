import type { McpStatus, McpTarget, RegistryFile } from "@mcp-registry/shared";

export type ProcessLogLevel = "info" | "stdout" | "stderr" | "error";

export interface ProcessLogEntry {
  id: string;
  serverId: string;
  serverName: string;
  level: ProcessLogLevel;
  message: string;
  createdAt: string;
}

export interface ProcessState {
  serverId: string;
  serverName: string;
  target: McpTarget;
  status: McpStatus;
  pid?: number;
  startedAt?: string;
  stoppedAt?: string;
  lastMessage?: string;
}

export interface ProcessSnapshot {
  processes: ProcessState[];
  logs: ProcessLogEntry[];
}

export interface ServerProcessResult extends ProcessSnapshot {
  registry: RegistryFile;
}

export const emptyProcessSnapshot = (): ProcessSnapshot => ({
  processes: [],
  logs: []
});

export function processStatusLabel(status: McpStatus) {
  const labels: Record<McpStatus, string> = {
    running: "실행 중",
    stopped: "중지됨",
    error: "오류",
    unknown: "확인 전"
  };

  return labels[status];
}
