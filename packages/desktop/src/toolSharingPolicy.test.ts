import { describe, expect, it } from "vitest";
import { isNewerVersion, shouldRequireSharedToolReview } from "./toolSharingPolicy";

describe("tool sharing policy", () => {
  it("allows safe tools to publish directly in open registration mode", () => {
    expect(
      shouldRequireSharedToolReview({
        mode: "open",
        riskWarnings: []
      })
    ).toBe(false);
  });

  it("keeps risky tools direct in open registration mode", () => {
    expect(
      shouldRequireSharedToolReview({
        mode: "open",
        riskWarnings: ["객체 삭제 동작이 감지되었습니다."]
      })
    ).toBe(false);
  });

  it("requires review for every tool in approval mode", () => {
    expect(
      shouldRequireSharedToolReview({
        mode: "approval",
        riskWarnings: []
      })
    ).toBe(true);
  });

  it("compares release tags against the current app version", () => {
    expect(isNewerVersion("v0.1.1", "v0.1.0")).toBe(true);
    expect(isNewerVersion("v0.1.0", "v0.1.0")).toBe(false);
    expect(isNewerVersion("v0.0.9", "v0.1.0")).toBe(false);
  });
});
