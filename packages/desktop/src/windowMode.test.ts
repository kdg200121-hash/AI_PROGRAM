import { describe, expect, it } from "vitest";
import { getWindowModeSize } from "./windowMode";

describe("getWindowModeSize", () => {
  it("uses a narrow vertical window for compact mode", () => {
    expect(getWindowModeSize(true)).toEqual({ width: 420, height: 760 });
  });

  it("uses the normal dashboard window size for regular mode", () => {
    expect(getWindowModeSize(false)).toEqual({ width: 1200, height: 760 });
  });
});
