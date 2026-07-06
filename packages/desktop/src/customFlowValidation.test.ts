import { describe, expect, it } from "vitest";
import {
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
          severity: "warning"
        })
      ])
    );
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
          severity: "error"
        })
      ])
    );
  });
});
