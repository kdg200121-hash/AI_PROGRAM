import { describe, expect, it } from "vitest";
import type { McpServerRecord, RegistryFile } from "@mcp-registry/shared";
import {
  createServerDraft,
  getSelectedServerId,
  serverDraftFromRecord,
  serverInputFromDraft,
  validateServerDraft
} from "./registryEditor";

const sampleServer: McpServerRecord = {
  id: "cad-default",
  name: "AutoCAD MCP Bridge",
  target: "cad",
  connectionType: "http",
  url: "http://localhost:5100/mcp",
  port: 5100,
  launchCommand: "acad-mcp-server.exe",
  workingDirectory: "C:\\Tools\\AutoCadMcpBridge",
  environment: {},
  status: "unknown",
  notes: "CAD connection placeholder",
  createdAt: "2026-07-03T00:00:00.000Z",
  updatedAt: "2026-07-03T00:00:00.000Z"
};

describe("registryEditor", () => {
  it("creates a CAD server draft ready for a new HTTP server", () => {
    expect(createServerDraft("cad")).toEqual({
      name: "",
      target: "cad",
      connectionType: "http",
      url: "http://localhost:5100/mcp",
      port: "5100",
      launchCommand: "",
      workingDirectory: "",
      notes: ""
    });
  });

  it("normalizes a draft into a registry server input", () => {
    const draft = serverDraftFromRecord(sampleServer);

    expect(serverInputFromDraft({ ...draft, port: " 5101 " })).toEqual({
      name: "AutoCAD MCP Bridge",
      target: "cad",
      connectionType: "http",
      url: "http://localhost:5100/mcp",
      port: 5101,
      launchCommand: "acad-mcp-server.exe",
      workingDirectory: "C:\\Tools\\AutoCadMcpBridge",
      environment: {},
      notes: "CAD connection placeholder"
    });
  });

  it("keeps selection when possible and falls back to the first saved server", () => {
    const registry: RegistryFile = { version: 1, servers: [sampleServer] };

    expect(getSelectedServerId(registry, "cad-default")).toBe("cad-default");
    expect(getSelectedServerId(registry, "missing")).toBe("cad-default");
    expect(getSelectedServerId({ version: 1, servers: [] }, "missing")).toBe("");
  });

  it("reports simple validation errors for an incomplete draft", () => {
    expect(
      validateServerDraft({
        ...createServerDraft("cad"),
        url: "not-a-url",
        port: "70000"
      })
    ).toEqual(["서버 이름을 입력하세요.", "URL 형식을 확인하세요.", "포트는 1-65535 사이여야 합니다.", "실행 명령을 입력하세요."]);
  });
});
