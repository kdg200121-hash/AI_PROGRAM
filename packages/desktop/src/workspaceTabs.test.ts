import { describe, expect, it } from "vitest";
import type { McpServerRecord } from "@mcp-registry/shared";
import {
  filterServersByWorkspace,
  getAdjacentWorkspaceTab,
  registryWorkspaceTab,
  workspaceTabs,
  type WorkspaceTabId
} from "./workspaceTabs";

const servers: McpServerRecord[] = [
  {
    id: "revit",
    name: "Revit MCP Bridge",
    target: "revit",
    connectionType: "http",
    url: "http://localhost:5101/mcp",
    port: 5101,
    launchCommand: "revit-mcp-bridge.exe",
    workingDirectory: "C:\\Tools\\RevitMcpBridge",
    environment: {},
    status: "unknown",
    notes: "",
    createdAt: "2026-07-03T00:00:00.000Z",
    updatedAt: "2026-07-03T00:00:00.000Z"
  },
  {
    id: "cad",
    name: "AutoCAD MCP Bridge",
    target: "cad",
    connectionType: "http",
    url: "http://localhost:5100/mcp",
    port: 5100,
    launchCommand: "acad-mcp-server.exe",
    workingDirectory: "C:\\Tools\\AutoCadMcpBridge",
    environment: {},
    status: "unknown",
    notes: "",
    createdAt: "2026-07-03T00:00:00.000Z",
    updatedAt: "2026-07-03T00:00:00.000Z"
  },
  {
    id: "excel",
    name: "Excel MCP Bridge",
    target: "excel",
    connectionType: "http",
    url: "http://localhost:5200/mcp",
    port: 5200,
    launchCommand: "excel-mcp-bridge.exe",
    workingDirectory: "C:\\Tools\\ExcelMcpBridge",
    environment: {},
    status: "unknown",
    notes: "",
    createdAt: "2026-07-03T00:00:00.000Z",
    updatedAt: "2026-07-03T00:00:00.000Z"
  },
  {
    id: "tekla",
    name: "Tekla MCP Bridge",
    target: "tekla",
    connectionType: "http",
    url: "http://localhost:5300/mcp",
    port: 5300,
    launchCommand: "tekla-mcp-bridge.exe",
    workingDirectory: "C:\\Tools\\TeklaMcpBridge",
    environment: {},
    status: "unknown",
    notes: "",
    createdAt: "2026-07-03T00:00:00.000Z",
    updatedAt: "2026-07-03T00:00:00.000Z"
  }
];

describe("filterServersByWorkspace", () => {
  it("keeps MCP Registry as a right-side action instead of a primary tab", () => {
    expect(registryWorkspaceTab.label).toBe("MCP Registry");
    expect(workspaceTabs.map((tab) => tab.id)).toEqual(["cad", "revit", "workflow"]);
  });

  it("uses the custom flow label for the workflow tab", () => {
    expect(workspaceTabs.find((tab) => tab.id === "workflow")?.label).toBe("Custom Flow");
  });

  it("cycles compact tab navigation through the primary tabs", () => {
    expect(getAdjacentWorkspaceTab("cad", "previous")).toBe("workflow");
    expect(getAdjacentWorkspaceTab("cad", "next")).toBe("revit");
    expect(getAdjacentWorkspaceTab("workflow", "next")).toBe("cad");
    expect(getAdjacentWorkspaceTab("registry", "next")).toBe("cad");
  });

  it.each([
    ["registry", ["revit", "cad", "excel", "tekla"]],
    ["cad", ["cad"]],
    ["revit", ["revit"]],
    ["workflow", ["revit", "cad", "excel", "tekla"]],
    ["excel", ["excel"]],
    ["tekla", ["tekla"]]
  ] satisfies Array<[WorkspaceTabId, string[]]>)(
    "filters visible servers for %s tab",
    (tabId, expectedIds) => {
      expect(filterServersByWorkspace(servers, tabId).map((server) => server.id)).toEqual(
        expectedIds
      );
    }
  );
});
