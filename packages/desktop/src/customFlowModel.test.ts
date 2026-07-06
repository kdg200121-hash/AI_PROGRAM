import { describe, expect, it } from "vitest";
import {
  defaultFlowNodes,
  flowConnectionEndpoint,
  flowNodeDisplayIconName,
  flowNodeWidth,
  parseDraggedFlowTool,
  flowToolPalette,
  type FlowNode
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
      y: node.y + 92
    });
    expect(flowConnectionEndpoint(node, "output", "objects")).toEqual({
      x: node.x + flowNodeWidth - 2,
      y: node.y + 92
    });
  });

  it("preserves explicit empty input and output port lists from dragged tools", () => {
    const parsed = parseDraggedFlowTool(
      JSON.stringify({
        id: "basic-result-preview",
        programIcon: "customTools",
        name: "결과 미리보기",
        description: "결과를 노드 안에서 확인합니다.",
        inputs: [{ id: "result", label: "결과", type: "any", iconName: "customTools" }],
        outputs: []
      })
    );

    expect(parsed?.inputs).toHaveLength(1);
    expect(parsed?.outputs).toEqual([]);
  });

  it("shows prompt nodes as detached until they are attached to another node", () => {
    const promptNode: FlowNode = {
      nodeId: "prompt-1",
      id: "basic-custom-prompt",
      programIcon: "promptDetached",
      name: "프롬프트",
      description: "노드 아래에 붙여 실행 프롬프트에 문장을 추가합니다.",
      inputs: [],
      outputs: [],
      x: 0,
      y: 0
    };

    expect(flowNodeDisplayIconName(promptNode)).toBe("promptDetached");
    expect(flowNodeDisplayIconName({ ...promptNode, attachedToNodeId: "node-1" })).toBe(
      "promptAttached"
    );
  });
});
