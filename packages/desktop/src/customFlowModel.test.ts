import { describe, expect, it } from "vitest";
import {
  activeFileOutputPortForSelections,
  applyFlowNodeDrag,
  defaultFlowNodes,
  flowConnectionEndpoint,
  flowNodeDisplayIconName,
  flowNodeWidth,
  flowToolPalette,
  insertStoredFlowGraphAsGroup,
  normalizeStoredBasicFlowNode,
  parseDraggedFlowTool,
  removeNodeIdsFromFlowGroups,
  type FlowNode,
  type FlowSnapshot
} from "./customFlowModel";

describe("customFlowModel", () => {
  it("exposes the built-in flow tools in the expected order", () => {
    expect(flowToolPalette.map((tool) => tool.id)).toEqual([
      "cad-read",
      "excel-export",
      "revit-list-levels",
      "revit-place",
      "cad-renumber-selected-text"
    ]);
    expect(flowToolPalette[0].outputs.map((port) => port.id)).toEqual(["objects", "excel-table"]);
    expect(flowToolPalette[2].inputs).toEqual([]);
    expect(flowToolPalette[2].outputs.map((port) => port.id)).toEqual(["levels"]);
    expect(flowToolPalette[3].inputs.map((port) => port.id)).toEqual(["excel-file", "coordinates"]);
  });

  it("keeps built-in flow tools executable with settings schemas", () => {
    expect(flowToolPalette[0].settingsSchema?.requiredServers).toEqual(["cad"]);
    expect(flowToolPalette[0].settingsSchema?.mcpCommands[0]).toMatchObject({
      server: "cad",
      command: "cad.read_objects",
      status: "available"
    });
    expect(flowToolPalette[0].settingsSchema?.settings.map((field) => field.id)).toContain(
      "selection_scope"
    );
    expect(flowToolPalette[0].settingsSchema?.settings.map((field) => field.id)).toEqual(
      expect.arrayContaining(["window_point1", "window_point2"])
    );
    expect(flowToolPalette[0].settingsSchema?.mcpCommands[0].params).toMatchObject({
      point1: "settings.window_point1",
      point2: "settings.window_point2"
    });
    expect(flowToolPalette[1].settingsSchema?.settings.map((field) => field.type)).toContain(
      "overwrite-policy"
    );
    expect(flowToolPalette[2].settingsSchema?.mcpCommands[0]).toMatchObject({
      server: "revit",
      command: "revit.list_levels",
      status: "available"
    });
    expect(flowToolPalette[2].settingsSchema?.resultSchema.type).toBe("table");
    expect(flowToolPalette[3].settingsSchema?.resultSchema.type).toBe("revit_element_ids");
  });

  it("exposes a safe selected AutoCAD text renumber tool", () => {
    const tool = flowToolPalette.find((item) => item.id === "cad-renumber-selected-text");

    expect(tool).toBeDefined();
    expect(tool?.inputs.map((port) => port.id)).toEqual(["cad-source"]);
    expect(tool?.outputs.map((port) => port.id)).toEqual(["renumbered-text"]);
    expect(tool?.settingsSchema?.requiredServers).toEqual(["cad"]);
    expect(tool?.settingsSchema?.risk).toBe("modify");
    expect(tool?.settingsSchema?.actions.map((action) => action.runtimeAction)).toEqual([
      "preview",
      "apply"
    ]);
    expect(tool?.settingsSchema?.actions.find((action) => action.runtimeAction === "apply")).toMatchObject({
      requiresPreview: true,
      confirm: true
    });
    expect(tool?.settingsSchema?.executionSteps?.map((step) => step.label)).toEqual([
      "순번 규칙 입력",
      "미리보기 확인",
      "도면에 적용"
    ]);
    expect(tool?.settingsSchema?.mcpCommands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          server: "cad",
          command: "cad.renumber_selected_text",
          runtimeAction: "preview",
          status: "available",
          params: expect.objectContaining({
            prefix: "settings.prefix",
            suffix: "settings.suffix",
            startNumber: "settings.start_number",
            padding: "settings.padding",
            apply: "false",
            confirmApply: "false"
          })
        }),
        expect.objectContaining({
          server: "cad",
          command: "cad.renumber_selected_text",
          runtimeAction: "apply",
          status: "available",
          params: expect.objectContaining({
            apply: "true",
            confirmApply: "true"
          })
        })
      ])
    );
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

  it("preserves dragged custom tool settings schemas", () => {
    const parsed = parseDraggedFlowTool(
      JSON.stringify({
        id: "menu-cad-tool",
        programIcon: "cad",
        name: "CAD 테스트 툴",
        description: "설정 스키마 테스트",
        inputs: [],
        outputs: [{ id: "result", label: "결과", type: "table" }],
        settingsSchema: {
          risk: "read",
          executionMode: "mcp",
          requiredServers: ["cad"],
          mcpCommands: [],
          preflightChecks: [],
          resultSchema: { type: "table", fields: [] },
          failurePolicy: { partialSuccess: "report", rollback: "none", log: true },
          settingsLayout: { mode: "simple", sections: [] },
          settings: [
            {
              id: "layer_name",
              label: "레이어",
              type: "layer",
              required: false,
              default: "",
              description: "읽을 레이어입니다."
            }
          ],
          actions: [],
          inputs: [],
          outputs: [{ id: "result", label: "결과", type: "table" }],
          testCases: []
        }
      })
    );

    expect(parsed?.settingsSchema?.settings[0].id).toBe("layer_name");
    expect(parsed?.settingsSchema?.requiredServers).toEqual(["cad"]);
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

  it("shows active file nodes as unknown until exactly one program is selected", () => {
    const activeFileNode: FlowNode = {
      nodeId: "active-file-1",
      id: "basic-active-file",
      programIcon: "activeFileUnknown",
      name: "활성 파일",
      description: "현재 열려 있는 파일을 입력값으로 사용합니다.",
      inputs: [],
      outputs: [],
      x: 0,
      y: 0
    };

    expect(flowNodeDisplayIconName(activeFileNode)).toBe("activeFileUnknown");
    expect(
      flowNodeDisplayIconName({
        ...activeFileNode,
        activeFileSelections: [
          {
            id: "active-excel",
            label: "현재 Excel 통합문서",
            program: "excel",
            path: "열려 있는 Excel 파일.xlsx"
          }
        ]
      })
    ).toBe("excel");
    expect(
      flowNodeDisplayIconName({
        ...activeFileNode,
        activeFileSelections: [
          {
            id: "active-excel",
            label: "현재 Excel 통합문서",
            program: "excel",
            path: "열려 있는 Excel 파일.xlsx"
          },
          {
            id: "active-cad",
            label: "현재 CAD 도면",
            program: "cad",
            path: "열려 있는 CAD 도면.dwg"
          }
        ]
      })
    ).toBe("activeFileUnknown");
  });

  it("uses the selected active file program as the output port type", () => {
    expect(
      activeFileOutputPortForSelections([
        {
          id: "active-cad",
          label: "평택 1층 평면.dwg",
          program: "cad",
          path: "C:/project/평택 1층 평면.dwg"
        }
      ])
    ).toMatchObject({
      label: "CAD",
      type: "cad",
      iconName: "cad"
    });
  });

  it("keeps basic path and active file nodes output-only when restoring stored nodes", () => {
    const pathNode = normalizeStoredBasicFlowNode({
      nodeId: "path-1",
      id: "basic-path-select",
      programIcon: "customTools",
      name: "경로 지정",
      description: "",
      inputs: [{ id: "stale-input", label: "입력", type: "text", iconName: "textData" }],
      outputs: [],
      x: 0,
      y: 0
    });
    const activeFileNode = normalizeStoredBasicFlowNode({
      nodeId: "active-file-1",
      id: "basic-active-file",
      programIcon: "activeFileUnknown",
      name: "활성 파일",
      description: "",
      inputs: [{ id: "stale-input", label: "입력", type: "file", iconName: "customTools" }],
      outputs: [],
      x: 0,
      y: 0
    });

    expect(pathNode.inputs).toEqual([]);
    expect(pathNode.outputs.map((port) => port.label)).toEqual(["경로"]);
    expect(activeFileNode.inputs).toEqual([]);
    expect(activeFileNode.outputs.map((port) => port.label)).toEqual(["활성 파일"]);
    expect(
      normalizeStoredBasicFlowNode({
        ...activeFileNode,
        activeFileSelections: [
          {
            id: "active-cad",
            label: "평택 1층 평면.dwg",
            program: "cad",
            path: "C:/project/평택 1층 평면.dwg"
          }
        ]
      }).outputs[0]
    ).toMatchObject({ label: "CAD", type: "cad", iconName: "cad" });
  });

  it("moves dragged nodes from their drag origins instead of accumulating from current positions", () => {
    const nodes = defaultFlowNodes();
    const origins = nodes.map((node) => ({ nodeId: node.nodeId, x: node.x, y: node.y }));
    const firstMove = applyFlowNodeDrag(nodes, origins, { x: 40, y: 12 });
    const secondMove = applyFlowNodeDrag(firstMove, origins, { x: 42, y: 15 });

    expect(secondMove[0].x).toBe(origins[0].x + 42);
    expect(secondMove[0].y).toBe(origins[0].y + 15);
    expect(secondMove[1].x).toBe(origins[1].x + 42);
    expect(secondMove[1].y).toBe(origins[1].y + 15);
  });

  it("removes node ids from flow groups and drops empty groups", () => {
    expect(
      removeNodeIdsFromFlowGroups(
        [
          { id: "group-1", name: "Group 1", color: "#bfdbfe", nodeIds: ["node-a", "node-b"] },
          { id: "group-2", name: "Group 2", color: "#bbf7d0", nodeIds: ["node-c"] }
        ],
        ["node-a", "node-c"]
      )
    ).toEqual([
      { id: "group-1", name: "Group 1", color: "#bfdbfe", nodeIds: ["node-b"] }
    ]);
  });

  it("inserts a saved flow as a grouped set of cloned nodes", () => {
    const sourceNodes = defaultFlowNodes();
    const snapshot: FlowSnapshot = {
      nodes: [],
      connections: [],
      groups: [],
      notes: []
    };

    const next = insertStoredFlowGraphAsGroup(
      snapshot,
      {
        nodes: sourceNodes,
        connections: [
          {
            id: "source-connection",
            fromNodeId: sourceNodes[0].nodeId,
            fromPortId: "objects",
            toNodeId: sourceNodes[1].nodeId,
            toPortId: "objects"
          }
        ],
        groups: [],
        notes: [],
        scale: 1,
        pan: { x: 0, y: 0 }
      },
      {
        flowName: "CAD to Excel",
        x: 200,
        y: 120,
        now: 1234
      }
    );

    expect(next.nodes).toHaveLength(2);
    expect(next.nodes.map((node) => node.nodeId)).toEqual([
      "import-1234-node-cad-read",
      "import-1234-node-excel-export"
    ]);
    expect(next.nodes[0]).toMatchObject({ x: 200, y: 120 });
    expect(next.connections).toEqual([
      {
        id: "import-1234-source-connection",
        fromNodeId: "import-1234-node-cad-read",
        fromPortId: "objects",
        toNodeId: "import-1234-node-excel-export",
        toPortId: "objects"
      }
    ]);
    expect(next.groups).toEqual([
      {
        id: "group-import-1234",
        name: "CAD to Excel",
        color: "#bfdbfe",
        nodeIds: ["import-1234-node-cad-read", "import-1234-node-excel-export"]
      }
    ]);
  });
});
