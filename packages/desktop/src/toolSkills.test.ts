import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const skillRoot = join(process.cwd(), "packages", "desktop", "assets", "skills");

describe("bundled MCP tool skills", () => {
  it("teaches /make and /save to create execution-step based tool pages", () => {
    const makeSkill = readFileSync(join(skillRoot, "mcp-tool-builder", "SKILL.md"), "utf8");
    const saveSkill = readFileSync(join(skillRoot, "save-tool", "SKILL.md"), "utf8");
    const reference = readFileSync(
      join(skillRoot, "mcp-tool-builder", "references", "ai-program-md-tool.md"),
      "utf8"
    );
    const saveScript = readFileSync(
      join(skillRoot, "save-tool", "scripts", "create_tool_draft.py"),
      "utf8"
    );

    for (const content of [makeSkill, saveSkill, reference]) {
      expect(content).toContain("실행 단계");
      expect(content).toContain("executionSteps");
      expect(content).toContain("작동 원리");
    }
    expect(makeSkill).toContain("Do not create a separate old-style `작동 원리` panel");
    expect(saveSkill).toContain("Do not create a separate old-style `작동 원리` panel");
    expect(reference).toContain("Use this current body structure even if older examples below mention `작동 원리`");
    expect(saveScript).toContain("executionSteps: []");
  });
});
