import { describe, expect, it } from "vitest";
import type { McpServerRecord } from "@mcp-registry/shared";
import { getConnectionSummary } from "./connectionSummary";

const baseServer: McpServerRecord = {
  id: "server",
  name: "Server",
  target: "revit",
  connectionType: "http",
  url: "http://localhost:5001/mcp",
  port: 5001,
  launchCommand: "server.exe",
  workingDirectory: "C:\\Tools\\Server",
  environment: {},
  status: "unknown",
  notes: "",
  createdAt: "2026-07-03T00:00:00.000Z",
  updatedAt: "2026-07-03T00:00:00.000Z"
};

describe("getConnectionSummary", () => {
  it("shows online only when every server is running", () => {
    expect(
      getConnectionSummary([
        { ...baseServer, id: "cad", target: "cad", status: "running" },
        { ...baseServer, id: "revit", target: "revit", status: "running" }
      ])
    ).toEqual({ tone: "online", label: "MCP 연결됨" });
  });

  it("shows offline when any server is not running", () => {
    expect(
      getConnectionSummary([
        { ...baseServer, id: "cad", target: "cad", status: "running" },
        { ...baseServer, id: "revit", target: "revit", status: "unknown" }
      ])
    ).toEqual({ tone: "offline", label: "MCP 미연결" });
  });

  it("shows no connection when the registry is empty", () => {
    expect(getConnectionSummary([])).toEqual({ tone: "offline", label: "MCP 연결 없음" });
  });

  it("uses the active page label for scoped connection state", () => {
    expect(getConnectionSummary([{ ...baseServer, target: "cad", status: "running" }], "CAD MCP")).toEqual({
      tone: "online",
      label: "CAD MCP 연결됨"
    });
  });
});
