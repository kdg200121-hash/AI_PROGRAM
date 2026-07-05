import { describe, expect, it } from "vitest";
import { getHiddenTabIds } from "./tabOverflow";

describe("tab overflow", () => {
  it("keeps the new tab button visible when every tab fits", () => {
    expect(
      getHiddenTabIds(
        [
          { id: "one", width: 120 },
          { id: "two", width: 120 },
          { id: "three", width: 120 }
        ],
        360
      )
    ).toEqual([]);
  });

  it("hides only trailing tabs that exceed the available width", () => {
    expect(
      getHiddenTabIds(
        [
          { id: "one", width: 120 },
          { id: "two", width: 120 },
          { id: "three", width: 120 },
          { id: "four", width: 120 }
        ],
        360
      )
    ).toEqual(["four"]);
  });

  it("does not alternate back to plus while tabs remain over capacity", () => {
    const tabs = [
      { id: "one", width: 120 },
      { id: "two", width: 120 },
      { id: "three", width: 120 },
      { id: "four", width: 120 }
    ];

    expect(getHiddenTabIds(tabs, 359)).toEqual(["three", "four"]);
    expect(getHiddenTabIds([...tabs, { id: "five", width: 120 }], 359)).toEqual([
      "three",
      "four",
      "five"
    ]);
  });
});
