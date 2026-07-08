import { describe, expect, it } from "vitest";
import {
  defaultFlowConnections,
  defaultFlowNodes,
  type FlowGroup
} from "./customFlowModel";
import {
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
