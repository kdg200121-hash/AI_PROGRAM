import { describe, expect, it } from "vitest";
import {
  defaultFlowNodes,
  flowConnectionEndpoint,
  flowNodeWidth,
  flowToolPalette
} from "./customFlowModel";

describe("customFlowModel", () => {
  it("uses readable Korean labels for the built-in flow tools", () => {
    expect(flowToolPalette.map((tool) => tool.name)).toEqual([
      "CAD 객체 읽기",
      "Excel 내보내기",
      "Revit 배치"
    ]);
    expect(flowToolPalette[0].outputs.map((port) => port.label)).toEqual(["객체", "Excel"]);
    expect(flowToolPalette[2].inputs.map((port) => port.label)).toEqual(["Excel", "좌표"]);
  });

  it("connects lines to the center of the visible port connector", () => {
    const [node] = defaultFlowNodes();

    expect(flowConnectionEndpoint(node, "input", "cad-source")).toEqual({
      x: node.x + 2,
      y: node.y + 104
    });
    expect(flowConnectionEndpoint(node, "output", "objects")).toEqual({
      x: node.x + flowNodeWidth - 2,
      y: node.y + 104
    });
  });
});
