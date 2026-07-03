import { describe, expect, it } from "vitest";
import { getToolsForWorkspace } from "./mcpToolCatalog";

describe("getToolsForWorkspace", () => {
  it("shows CAD tools on the CAD tab", () => {
    expect(getToolsForWorkspace("cad").map((tool) => tool.name)).toEqual([
      "도면 객체 읽기",
      "레이어 정보 추출",
      "블록 위치 수집"
    ]);
  });

  it("shows Revit tools on the REVIT tab", () => {
    expect(getToolsForWorkspace("revit").map((tool) => tool.name)).toEqual([
      "요소 생성",
      "패밀리 배치",
      "파라미터 업데이트"
    ]);
  });

  it("shows bridge tools on the CAD <-> REVIT tab", () => {
    expect(getToolsForWorkspace("workflow").map((tool) => tool.name)).toEqual([
      "CAD 정보 변환",
      "Revit 실행 큐",
      "동기화 결과 확인"
    ]);
  });
});
