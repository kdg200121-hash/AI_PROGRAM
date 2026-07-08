import { describe, expect, it } from "vitest";
import { buildSkillUpdateDraft, collectToolLearningEntries } from "./skillLearningDashboard";

describe("skillLearningDashboard", () => {
  it("collects pending and applied learning log entries from tools", () => {
    const entries = collectToolLearningEntries(
      [
        {
          id: "tool-a",
          name: "CAD 번호 정리",
          version: "1.0.0",
          author: "김동건축",
          path: "github:repo/tools/cad.md",
          learningLog: [
            {
              id: "log-a",
              title: "설정 질문 부족",
              summary: "화면 번호 처리 질문이 부족했습니다.",
              recommendation: "/make 질문 목록에 번호 규칙을 추가합니다."
            }
          ]
        }
      ],
      ["log-a"]
    );

    expect(entries).toEqual([
      expect.objectContaining({
        id: "log-a",
        toolName: "CAD 번호 정리",
        status: "applied",
        recommendation: "/make 질문 목록에 번호 규칙을 추가합니다."
      })
    ]);
  });

  it("builds a reviewable draft without marking applied entries again", () => {
    const entries = collectToolLearningEntries(
      [
        {
          id: "tool-a",
          name: "CAD 번호 정리",
          version: "1.0.0",
          author: "김동건축",
          learningLog: [{ id: "pending-log", title: "미리보기 필요", summary: "결과 미리보기가 필요합니다." }]
        },
        {
          id: "tool-b",
          name: "Excel 정리",
          version: "1.0.0",
          author: "김동건축",
          learningLog: [{ id: "applied-log", title: "반영됨", summary: "이미 반영된 항목입니다." }]
        }
      ],
      ["applied-log"]
    );

    const draft = buildSkillUpdateDraft(entries);

    expect(draft).toContain("미리보기 필요");
    expect(draft).toContain("결과 미리보기가 필요합니다.");
    expect(draft).not.toContain("이미 반영된 항목입니다.");
  });
});
