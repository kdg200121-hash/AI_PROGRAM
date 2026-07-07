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
  it("documents the registration trigger and OpenAI API settings flow", () => {
    const skill = readFileSync(skillPath, "utf8");

    expect(skill).toContain("/등록");
    expect(skill).toContain("Settings > AI 연결");
    expect(skill).toContain("API 키를 채팅, 로그, GitHub, 툴 MD 파일에 기록하지 않는다.");
  });
});
