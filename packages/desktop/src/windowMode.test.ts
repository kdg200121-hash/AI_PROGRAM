import { describe, expect, it } from "vitest";
import { getWindowModeSize } from "./windowMode";

describe("getWindowModeSize", () => {
  it("uses a player view window wide enough for inline tool settings", () => {
    expect(getWindowModeSize(true)).toEqual({ width: 560, height: 780 });
  });

  it("uses the normal dashboard window size for regular mode", () => {
    expect(getWindowModeSize(false)).toEqual({ width: 1440, height: 900 });
  });
});
