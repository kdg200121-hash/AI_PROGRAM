import { describe, expect, it } from "vitest";
import { calculateSmartGuideSnap, type SmartGuideRect } from "./customFlowSmartGuides";

const rect = (
  id: string,
  left: number,
  top: number,
  width = 100,
  height = 80
): SmartGuideRect => ({
  id,
  left,
  top,
  right: left + width,
  bottom: top + height
});

describe("customFlowSmartGuides", () => {
  it("snaps a dragged node center to another node center", () => {
    const result = calculateSmartGuideSnap({
      moving: rect("moving", 194, 40, 300),
      stationary: [rect("target", 300, 120)],
      threshold: 8
    });

    expect(result.deltaX).toBe(6);
    expect(result.guides).toContainEqual({
      axis: "x",
      type: "align",
      position: 350,
      start: 40,
      end: 200
    });
  });

  it("snaps a dragged node into the same horizontal gap between two nodes", () => {
    const result = calculateSmartGuideSnap({
      moving: rect("moving", 194, 40),
      stationary: [rect("left", 40, 40), rect("right", 360, 40)],
      threshold: 8
    });

    expect(result.deltaX).toBe(6);
    expect(result.guides).toContainEqual({
      axis: "x",
      type: "spacing",
      position: 200,
      start: 40,
      end: 120
    });
  });

  it("snaps a dragged node into the same vertical gap between two nodes", () => {
    const result = calculateSmartGuideSnap({
      moving: rect("moving", 40, 174),
      stationary: [rect("top", 40, 40), rect("bottom", 40, 320)],
      threshold: 8
    });

    expect(result.deltaY).toBe(6);
    expect(result.guides).toContainEqual({
      axis: "y",
      type: "spacing",
      position: 180,
      start: 40,
      end: 140
    });
  });
});
