import type { McpServerRecord } from "@mcp-registry/shared";

export type WorkspaceTabId = "registry" | "cad" | "revit" | "workflow" | "excel" | "tekla";

export interface WorkspaceTab {
  id: WorkspaceTabId;
  label: string;
}

export const registryWorkspaceTab: WorkspaceTab = { id: "registry", label: "MCP Registry" };

export const workspaceTabs: WorkspaceTab[] = [
  { id: "cad", label: "CAD" },
  { id: "revit", label: "REVIT" },
  { id: "workflow", label: "Custom Flow" }
];

export function getAdjacentWorkspaceTab(
  activeTab: WorkspaceTabId,
  direction: "previous" | "next"
): WorkspaceTabId {
  const currentIndex = workspaceTabs.findIndex((tab) => tab.id === activeTab);
  if (currentIndex === -1) {
    return direction === "next" ? workspaceTabs[0].id : workspaceTabs[workspaceTabs.length - 1].id;
  }

  const offset = direction === "next" ? 1 : -1;
  const nextIndex = (currentIndex + offset + workspaceTabs.length) % workspaceTabs.length;
  return workspaceTabs[nextIndex].id;
}

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
