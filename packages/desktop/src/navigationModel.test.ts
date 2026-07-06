import { describe, expect, it } from "vitest";
import { overviewCards, sidebarSections, workflowSteps } from "./navigationModel";

describe("navigationModel", () => {
  it("defines the left navigation as screen sections, not target tabs", () => {
    expect(sidebarSections.map((section) => section.id)).toEqual([
      "servers",
      "revit",
      "workflow",
      "excel",
      "tekla"
    ]);
    expect(sidebarSections.map((section) => section.label)).toEqual([
      "CAD",
      "Revit",
      "Custom Flow",
      "Excel",
      "Tekla"
    ]);
  });

  it("provides operational overview cards for the empty area", () => {
    expect(overviewCards.map((card) => card.title)).toEqual([
      "최근 연결 로그",
      "다음 작업 대기",
      "변환 준비 상태"
    ]);
  });

  it("documents the custom flow stages", () => {
    expect(workflowSteps.map((step) => step.title)).toEqual([
      "툴 선택",
      "노드 연결",
      "자동 실행"
    ]);
  });
});
