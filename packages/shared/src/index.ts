export type McpTarget = "cad" | "revit" | "excel" | "tekla" | "other";

export type McpConnectionType = "stdio" | "http" | "sse";

export type McpStatus = "unknown" | "running" | "stopped" | "error";

export interface McpServerRecord {
  id: string;
  name: string;
  target: McpTarget;
  connectionType: McpConnectionType;
  url: string;
  port: number | null;
  launchCommand: string;
  workingDirectory: string;
  environment: Record<string, string>;
  status: McpStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface RegistryFile {
  version: 1;
  servers: McpServerRecord[];
}
