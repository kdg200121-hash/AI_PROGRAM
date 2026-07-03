import { describe, expect, it } from "vitest";
import { overviewCards, sidebarSections, workflowSteps } from "./navigationModel";

describe("navigationModel", () => {
  it("defines the left navigation as screen sections, not target tabs", () => {
    expect(sidebarSections.map((section) => section.id)).toEqual([
      "servers",
      "workflow",
      "excel",
      "tekla"
    ]);
    expect(sidebarSections.map((section) => section.label)).toEqual([
      "MCP Servers",
      "CAD ↔ Revit",
      "Excel",
      "Tekla"
    ]);
  });

  it("provides operational overview cards for the empty area", () => {
    expect(overviewCards.map((card) => card.title)).toEqual([
      "최근 연결 로그",
      "다음 작업 큐",
      "변환 준비 상태"
    ]);
  });

  it("documents the CAD to Revit workflow stages", () => {
    expect(workflowSteps.map((step) => step.title)).toEqual([
      "CAD 정보 읽기",
      "데이터 변환",
      "Revit 실행"
    ]);
  });
});
