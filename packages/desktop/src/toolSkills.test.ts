import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const skillRoot = join(process.cwd(), "packages", "desktop", "assets", "skills");
const brokenEncodingPattern = /�|\?꾩|\?ㅽ|\?묐|\?낅|\?먮|\?대|\?쒕|\?좏|\?곌|\?몃|\?뚯/;

describe("bundled MCP tool skills", () => {
  it("keeps /make and /save instructions readable and aligned with execution-step tools", () => {
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
      expect(content).toContain("설정창");
      expect(content).toContain("learningLog");
      expect(content).not.toMatch(brokenEncodingPattern);
    }
    expect(makeSkill).toContain("스무고개처럼");
    expect(saveSkill).toContain("Do not upload");
    expect(reference).toContain("AI Program must ignore learningLog at runtime");
    expect(saveScript).toContain("executionSteps: []");
  });
});
