import { describe, expect, it } from "vitest";
import type { McpServerRecord } from "@mcp-registry/shared";
import { filterServersByWorkspace, type WorkspaceTabId } from "./workspaceTabs";

const servers: McpServerRecord[] = [
  {
    id: "revit",
    name: "Revit MCP Bridge",
    target: "revit",
    connectionType: "http",
    url: "http://localhost:5001/mcp",
    port: 5001,
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
  }
];

describe("filterServersByWorkspace", () => {
  it.each([
    ["registry", ["revit", "cad"]],
    ["cad", ["cad"]],
    ["revit", ["revit"]],
    ["workflow", ["revit", "cad"]]
  ] satisfies Array<[WorkspaceTabId, string[]]>)(
    "filters visible servers for %s tab",
    (tabId, expectedIds) => {
      expect(filterServersByWorkspace(servers, tabId).map((server) => server.id)).toEqual(
        expectedIds
      );
    }
  );
});
