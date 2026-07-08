import { describe, expect, it } from "vitest";
import {
  activeFileOutputPortForSelections,
  defaultFlowConnections,
  defaultFlowNodes,
  type FlowConnection
} from "./customFlowModel";
import { validateFlowGraph } from "./customFlowValidation";

describe("customFlowValidation", () => {
  it("accepts the default flow without errors", () => {
    const issues = validateFlowGraph(defaultFlowNodes(), defaultFlowConnections());

    expect(issues.filter((issue) => issue.severity === "error")).toEqual([]);
  });

  it("reports incompatible port types", () => {
    const nodes = defaultFlowNodes();
    const badConnection: FlowConnection = {
      id: "bad",
      fromNodeId: nodes[0].nodeId,
      fromPortId: "excel-table",
      toNodeId: nodes[1].nodeId,
      toPortId: "objects"
    };

    expect(validateFlowGraph(nodes, [badConnection])).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "type-mismatch-bad",
          severity: "warning",
          title: "포트 타입 불일치"
        })
      ])
    );
  });

  it("accepts a CAD active file output connected to CAD object read input", () => {
    const [cadReadNode] = defaultFlowNodes();
    const activeFileNode = {
      nodeId: "active-file-1",
      id: "basic-active-file",
      programIcon: "activeFileUnknown" as const,
      name: "활성 파일",
      description: "현재 열려 있는 파일을 입력값으로 사용합니다.",
      inputs: [],
      outputs: [
        activeFileOutputPortForSelections([
          {
            id: "active-cad",
            label: "평택 1층 평면.dwg",
            program: "cad",
            path: "C:/project/평택 1층 평면.dwg"
          }
        ])
      ],
      x: 0,
      y: 0
    };
    const issues = validateFlowGraph(
      [activeFileNode, cadReadNode],
      [
        {
          id: "active-cad-to-read",
          fromNodeId: activeFileNode.nodeId,
          fromPortId: "active-file",
          toNodeId: cadReadNode.nodeId,
          toPortId: "cad-source"
        }
      ]
    );

    expect(issues.some((issue) => issue.id === "type-mismatch-active-cad-to-read")).toBe(false);
  });

  it("reports dangling connections", () => {
    expect(
      validateFlowGraph(defaultFlowNodes(), [
        {
          id: "dangling",
          fromNodeId: "missing",
          fromPortId: "out",
          toNodeId: "also-missing",
          toPortId: "in"
        }
      ])
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "missing-node-dangling",
          severity: "error",
          title: "없는 노드 연결"
        })
      ])
    );
  });

  it("reports disconnected flows with readable Korean messages", () => {
    expect(validateFlowGraph(defaultFlowNodes(), [])).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "missing-input-node-excel-export-objects",
          severity: "warning",
          title: "입력 미연결"
        }),
        expect.objectContaining({
          id: "no-connections",
          severity: "warning",
          title: "연결 없음"
        })
      ])
    );
  });

  it("reports an empty flow", () => {
    expect(validateFlowGraph([], [])).toEqual([
      expect.objectContaining({
        id: "empty-flow",
        severity: "error",
        title: "노드 없음"
      })
    ]);
  });

  it("reports missing required settings on schema-driven nodes", () => {
    const issues = validateFlowGraph(
      [
        {
          nodeId: "node-excel",
          id: "excel-export",
          programIcon: "excel",
          name: "Excel 내보내기",
          description: "",
          inputs: [],
          outputs: [],
          x: 0,
          y: 0,
          settingsSchema: {
            risk: "create",
            executionMode: "mcp",
            requiredServers: ["excel"],
            mcpCommands: [],
            preflightChecks: [],
            resultSchema: { type: "file", fields: [] },
            failurePolicy: { partialSuccess: "report", rollback: "none", log: true },
            actions: [],
            settingsLayout: { mode: "simple", sections: [] },
            settings: [
              {
                id: "export_path",
                label: "저장 경로",
                type: "folder",
                required: true,
                default: "",
                description: "Excel 파일을 저장할 폴더입니다."
              }
            ],
            inputs: [],
            outputs: [],
            testCases: []
          },
          settingsValues: { export_path: "" }
        }
      ],
      []
    );

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "node-setting-node-excel-missing-setting-export_path",
          severity: "error",
          nodeId: "node-excel"
        })
      ])
    );
  });
});
