import { describe, expect, it } from "vitest";
import {
  cloneFlowTool,
  defaultFlowConnections,
  defaultFlowNodes,
  flowToolPalette,
  type FlowGroup
} from "./customFlowModel";
import {
  buildFlowResultPreviewFromPayload,
  buildFlowGroupToolSchema,
  buildFlowRunRecords,
  resolveFlowRunNodeIds
} from "./customFlowRunModel";
import { validateToolRuntimeSchema } from "./toolRuntimeValidation";

describe("customFlowRunModel", () => {
  it("resolves run scopes for step execution", () => {
    const nodes = defaultFlowNodes();
    const connections = defaultFlowConnections();

    expect(resolveFlowRunNodeIds(nodes, connections, "step", "selected", nodes[1].nodeId)).toEqual([
      nodes[1].nodeId
    ]);
    expect(resolveFlowRunNodeIds(nodes, connections, "batch", "to-selected", nodes[1].nodeId)).toEqual([
      nodes[0].nodeId,
      nodes[1].nodeId
    ]);
    expect(resolveFlowRunNodeIds(nodes, connections, "batch", "from-selected", nodes[0].nodeId)).toEqual([
      nodes[0].nodeId,
      nodes[1].nodeId
    ]);
  });

  it("resolves run scopes by graph connections instead of node array order", () => {
    const nodes = defaultFlowNodes();
    const reversedNodes = [...nodes].reverse();
    const connections = defaultFlowConnections();

    expect(resolveFlowRunNodeIds(reversedNodes, connections, "batch", "all")).toEqual([
      nodes[0].nodeId,
      nodes[1].nodeId
    ]);
    expect(
      resolveFlowRunNodeIds(reversedNodes, connections, "batch", "to-selected", nodes[1].nodeId)
    ).toEqual([nodes[0].nodeId, nodes[1].nodeId]);
    expect(
      resolveFlowRunNodeIds(reversedNodes, connections, "batch", "from-selected", nodes[0].nodeId)
    ).toEqual([nodes[0].nodeId, nodes[1].nodeId]);
  });

  it("builds preview, impact, and log records for selected nodes", () => {
    const nodes = defaultFlowNodes();
    const records = buildFlowRunRecords(nodes, defaultFlowConnections(), [
      nodes[0].nodeId,
      nodes[1].nodeId
    ]);

    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({
      nodeId: nodes[0].nodeId,
      preview: expect.objectContaining({
        title: "CAD 객체 읽기 결과 미리보기"
      }),
      impact: expect.objectContaining({
        title: "읽기 전용"
      })
    });
    expect(records[1].impact.items.join(" ")).toContain("파일 생성");
  });

  it("shows Revit level reads as level-list results in run logs", () => {
    const tool = flowToolPalette.find((item) => item.id === "revit-list-levels");
    expect(tool).toBeDefined();
    const node = {
      ...cloneFlowTool(tool!),
      nodeId: "node-revit-list-levels",
      x: 0,
      y: 0
    };

    const [record] = buildFlowRunRecords([node], [], [node.nodeId]);

    expect(record.preview).toMatchObject({
      title: "Revit 레벨 읽기 결과 미리보기",
      summary: expect.stringContaining("Revit 모델"),
      metrics: expect.arrayContaining([
        { label: "결과 형태", value: "Revit 레벨 목록" }
      ])
    });
  });

  it("turns real Revit level MCP payloads into preview table rows", () => {
    const tool = flowToolPalette.find((item) => item.id === "revit-list-levels");
    expect(tool).toBeDefined();
    const node = {
      ...cloneFlowTool(tool!),
      nodeId: "node-revit-list-levels",
      x: 0,
      y: 0
    };
    const [record] = buildFlowRunRecords([node], [], [node.nodeId]);

    const preview = buildFlowResultPreviewFromPayload(
      node,
      {
        ok: true,
        command: "revit.list_levels",
        count: 2,
        levels: [
          { id: "1", name: "Level 1", elevationFeet: 0 },
          { id: "2", name: "Level 2", elevationFeet: 12.5 }
        ]
      },
      record.preview
    );

    expect(preview.metrics).toEqual([
      { label: "결과 형태", value: "Revit 레벨 목록" },
      { label: "레벨 수", value: "2" }
    ]);
    expect(preview.rows).toEqual([
      { 순서: "1", "레벨 ID": "1", "레벨 이름": "Level 1", "높이(ft)": "0" },
      { 순서: "2", "레벨 ID": "2", "레벨 이름": "Level 2", "높이(ft)": "12.5" }
    ]);
  });

  it("turns selected AutoCAD text renumber payloads into readable preview rows", () => {
    const tool = flowToolPalette.find((item) => item.id === "cad-renumber-selected-text");
    expect(tool).toBeDefined();
    const node = {
      ...cloneFlowTool(tool!),
      nodeId: "node-cad-renumber",
      x: 0,
      y: 0
    };
    const [record] = buildFlowRunRecords([node], [], [node.nodeId]);

    const preview = buildFlowResultPreviewFromPayload(
      node,
      {
        ok: true,
        command: "cad.renumber_selected_text",
        previewOnly: true,
        rows: [
          { handle: "A1", layer: "TEXT", oldText: "101", newText: "A-001", applied: false }
        ]
      },
      record.preview
    );

    expect(preview.metrics).toEqual([
      { label: "결과 형태", value: "CAD 문자 순번 변경" },
      { label: "문자 수", value: "1" },
      { label: "실행 방식", value: "미리보기" }
    ]);
    expect(preview.rows).toEqual([
      {
        순서: "1",
        핸들: "A1",
        레이어: "TEXT",
        "기존 문자": "101",
        "변경 문자": "A-001",
        "적용 여부": "아니오"
      }
    ]);
  });

  it("builds a reusable custom-flow schema from a group", () => {
    const nodes = defaultFlowNodes();
    const group: FlowGroup = {
      id: "group-1",
      name: "CAD to Excel",
      color: "#bfdbfe",
      nodeIds: nodes.map((node) => node.nodeId)
    };
    const schema = buildFlowGroupToolSchema(group, nodes, defaultFlowConnections());

    expect(schema.executionMode).toBe("custom-flow");
    expect(schema.requiredServers).toEqual(["cad", "excel"]);
    expect(schema.outputs.map((port) => port.label)).toContain("Excel");
    expect(schema.settings.map((field) => field.id)).toEqual([
      "node-cad-read__selection_scope",
      "node-cad-read__window_point1",
      "node-cad-read__window_point2",
      "node-cad-read__object_types",
      "node-cad-read__unit",
      "node-cad-read__tolerance",
      "node-excel-export__export_path",
      "node-excel-export__file_name_template",
      "node-excel-export__overwrite_policy"
    ]);
    expect(schema.mcpCommands.map((command) => command.command)).toEqual([
      "cad.read_objects",
      "excel.write_table"
    ]);
    expect(schema.mcpCommands[0].params).toMatchObject({
      point1: "settings.node-cad-read__window_point1",
      point2: "settings.node-cad-read__window_point2"
    });
    expect(validateToolRuntimeSchema(schema).filter((issue) => issue.severity === "error")).toEqual([]);
  });

  it("builds reusable custom-flow schemas in graph order", () => {
    const nodes = defaultFlowNodes();
    const reversedNodes = [...nodes].reverse();
    const group: FlowGroup = {
      id: "group-1",
      name: "CAD to Excel",
      color: "#bfdbfe",
      nodeIds: reversedNodes.map((node) => node.nodeId)
    };
    const schema = buildFlowGroupToolSchema(group, reversedNodes, defaultFlowConnections());

    expect(schema.inputs.map((port) => port.label)).toEqual(["CAD"]);
    expect(schema.outputs.map((port) => port.label)).toContain("Excel");
    expect(schema.mcpCommands.map((command) => command.command)).toEqual([
      "cad.read_objects",
      "excel.write_table"
    ]);
  });
});
