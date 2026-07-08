import { describe, expect, it } from "vitest";
import {
  defaultFlowConnections,
  defaultFlowNodes,
  insertStoredFlowGraphAsGroup,
  flowToolPalette,
  type FlowGroup,
  type FlowSnapshot
} from "./customFlowModel";
import { buildFlowGroupToolSchema, buildFlowRunRecords, resolveFlowRunNodeIds } from "./customFlowRunModel";
import { validateFlowGraph } from "./customFlowValidation";
import { validateToolRuntimeSchema } from "./toolRuntimeValidation";

const brokenKoreanPattern = /[�]|쨌|媛|寃|뚯|젣|꾩|鍮|紐|醫|誘|몃|덉|섏|蹂|諛|異|濡|낵|낅|쒕/;

describe("custom flow pre-release simulation", () => {
  it("runs the default CAD to Excel flow through validation, ordering, preview, and reusable schema gates", () => {
    const nodes = defaultFlowNodes();
    const connections = defaultFlowConnections();

    expect(validateFlowGraph(nodes, connections).filter((issue) => issue.severity === "error")).toEqual([]);
    expect(resolveFlowRunNodeIds(nodes, connections, "batch", "all")).toEqual([
      "node-cad-read",
      "node-excel-export"
    ]);
    expect(resolveFlowRunNodeIds(nodes, connections, "step", "all")).toEqual(["node-cad-read"]);

    const records = buildFlowRunRecords(nodes, connections, nodes.map((node) => node.nodeId));
    expect(records.map((record) => record.nodeName)).toEqual(["CAD 객체 읽기", "Excel 내보내기"]);
    expect(records[0].message).toContain("다음 1개 연결");
    expect(records[1].impact.items.join(" ")).toContain("파일 생성 예정");

    const group: FlowGroup = {
      id: "group-cad-excel",
      name: "CAD 객체 Excel 정리",
      color: "#bfdbfe",
      nodeIds: nodes.map((node) => node.nodeId)
    };
    const schema = buildFlowGroupToolSchema(group, nodes, connections);
    expect(schema.executionMode).toBe("custom-flow");
    expect(schema.requiredServers).toEqual(["cad", "excel"]);
    expect(schema.mcpCommands.map((command) => command.command)).toEqual([
      "cad.read_objects",
      "excel.write_table"
    ]);
    expect(validateToolRuntimeSchema(schema).filter((issue) => issue.severity === "error")).toEqual([]);

    expect(JSON.stringify({ flowToolPalette, nodes, records, schema })).not.toMatch(brokenKoreanPattern);
  });

  it("imports a shared or custom flow onto the canvas as a grouped, remapped node set", () => {
    const sourceNodes = defaultFlowNodes();
    const sourceConnections = defaultFlowConnections();
    const snapshot: FlowSnapshot = { nodes: [], connections: [], groups: [], notes: [] };

    const next = insertStoredFlowGraphAsGroup(
      snapshot,
      {
        nodes: sourceNodes,
        connections: sourceConnections,
        groups: [],
        notes: [],
        scale: 1,
        pan: { x: 0, y: 0 }
      },
      {
        flowName: "공유 CAD Excel 플로우",
        x: 640,
        y: 320,
        now: 42
      }
    );

    expect(next.nodes).toHaveLength(2);
    expect(next.nodes.every((node) => node.nodeId.startsWith("import-42-"))).toBe(true);
    expect(next.connections).toEqual([
      expect.objectContaining({
        fromNodeId: "import-42-node-cad-read",
        toNodeId: "import-42-node-excel-export"
      })
    ]);
    expect(next.groups).toEqual([
      expect.objectContaining({
        name: "공유 CAD Excel 플로우",
        nodeIds: ["import-42-node-cad-read", "import-42-node-excel-export"]
      })
    ]);
  });
});
