import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const skillPath = join(
  process.cwd(),
  "packages",
  "desktop",
  "assets",
  "skills",
  "program-mcp-registrar",
  "SKILL.md"
);

describe("program-mcp-registrar bundled skill", () => {
  it("documents registration, MCP verification, and Codex/MCP roles", () => {
    const skill = readFileSync(skillPath, "utf8");

    expect(skill).toContain("/등록");
    expect(skill).toContain("MCP 명령 목록");
    expect(skill).toContain("Codex와 MCP 역할");
    expect(skill).toContain("codex mcp add");
    expect(skill).toContain("ai-program-cad");
    expect(skill).not.toContain("AI 연결");
  });
});
