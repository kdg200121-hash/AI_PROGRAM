import { describe, expect, it } from "vitest";
import { validateServerInput } from "../validation";

describe("validateServerInput", () => {
  it("accepts a valid Revit HTTP connection", () => {
    const result = validateServerInput({
      name: "Revit MCP Bridge",
      target: "revit",
      connectionType: "http",
      url: "http://localhost:5101/mcp",
      port: 5101,
      launchCommand: "revit-mcp-bridge.exe",
      workingDirectory: "C:\\Tools\\RevitMcpBridge",
      environment: {},
      notes: ""
    });

    expect(result).toEqual({ ok: true, errors: [] });
  });

  it("returns simple Korean messages for invalid input", () => {
    const result = validateServerInput({
      name: "",
      target: "cad",
      connectionType: "http",
      url: "not-a-url",
      port: 70000,
      launchCommand: "",
      workingDirectory: "",
      environment: {},
      notes: ""
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("서버 이름을 입력해야 합니다.");
    expect(result.errors).toContain("URL 형식이 올바르지 않습니다.");
    expect(result.errors).toContain("포트는 1부터 65535 사이여야 합니다.");
    expect(result.errors).toContain("실행 명령을 입력해야 합니다.");
  });
});
