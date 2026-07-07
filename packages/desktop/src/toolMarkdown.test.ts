import { describe, expect, it } from "vitest";
import { detectToolRiskWarnings, isToolMarkdown, parseToolMetadata } from "./toolMarkdown";

describe("toolMarkdown", () => {
  it("recognizes AI Program tool drafts with executable MCP metadata", () => {
    const content = `---
tool: true
toolName: "CAD 블록 좌표 수집"
version: "1.0.0"
author: "tester"
sectionId: "cad"
executionMode: "mcp"
requiredServers:
  - cad
mcpCommands:
  - server: cad
    command: cad.read_blocks
settingsLayout:
  mode: "sections"
settings: []
inputs: []
outputs: []
---

# CAD 블록 좌표 수집

CAD 블록 좌표를 읽어 표로 정리합니다.`;

    expect(isToolMarkdown(content)).toBe(true);
  });

  it("detects explicit delete risk from frontmatter", () => {
    const content = `---
tool: true
toolName: "Revit 요소 삭제"
risk: delete
sectionId: "revit"
---

# Revit 요소 삭제

선택한 Revit 요소를 삭제합니다.`;

    expect(detectToolRiskWarnings(content)).toContain(
      "MD metadata에 삭제/덮어쓰기 위험도가 표시되어 있습니다."
    );
  });

  it("detects bulk modify risk and command-based model changes", () => {
    const content = `---
tool: true
toolName: "CAD 레이어 일괄 변경"
risk: bulk-modify
sectionId: "cad"
mcpCommands:
  - server: cad
    command: cad.update_layer_objects
---

# CAD 레이어 일괄 변경

도면 객체의 레이어를 일괄 수정합니다.`;

    const warnings = detectToolRiskWarnings(content);
    expect(warnings).toContain("MD metadata에 대량 수정 위험도가 표시되어 있습니다.");
    expect(warnings).toContain(
      "MD 내용에서 모델 객체나 요소를 수정/이동/일괄 변경할 수 있는 동작이 감지되었습니다."
    );
  });

  it("keeps simple metadata parsing compatible with existing drafts", () => {
    const metadata = parseToolMetadata(`---
toolName: "기존 툴"
version: "1.0.0"
sectionId: "servers"
---

# 기존 툴`);

    expect(metadata).toMatchObject({
      toolName: "기존 툴",
      version: "1.0.0",
      sectionId: "servers"
    });
  });
});
