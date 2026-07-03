import type { McpServerRecord } from "@mcp-registry/shared";

export type WorkspaceTabId = "registry" | "cad" | "revit" | "workflow";

export interface WorkspaceTab {
  id: WorkspaceTabId;
  label: string;
}

export const workspaceTabs: WorkspaceTab[] = [
  { id: "registry", label: "MCP Registry" },
  { id: "cad", label: "CAD" },
  { id: "revit", label: "REVIT" },
  { id: "workflow", label: "CAD <-> REVIT" }
];

export function filterServersByWorkspace(
  servers: McpServerRecord[],
  tabId: WorkspaceTabId
): McpServerRecord[] {
  if (tabId === "cad") {
    return servers.filter((server) => server.target === "cad");
  }

  if (tabId === "revit") {
    return servers.filter((server) => server.target === "revit");
  }

  return servers;
}
