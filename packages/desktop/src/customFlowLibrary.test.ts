import { describe, expect, it } from "vitest";
import {
  createSavedFlow,
  duplicateSavedFlow,
  listWorkflowMenuFlowItems,
  listSavedFlows,
  parseWorkflowMenuFlowId,
  removeSavedFlow,
  renameSavedFlow,
  updateSavedFlowDetails,
  updateSavedFlowGraph,
  isStoredFlowGraphDirty,
  workflowMenuFlowId,
  type SavedCustomFlow
} from "./customFlowLibrary";
import type { StoredFlowGraph } from "./customFlowModel";

const graph: StoredFlowGraph = {
  nodes: [],
  connections: [],
  groups: [],
  notes: [],
  scale: 1,
  pan: { x: 0, y: 0 }
};

describe("customFlowLibrary", () => {
  it("lists saved flows by newest update first", () => {
    const first = createSavedFlow("CAD to Revit", graph, 100);
    const second = createSavedFlow("Excel report", graph, 300);

    expect(listSavedFlows([first, second]).map((flow) => flow.name)).toEqual([
      "Excel report",
      "CAD to Revit"
    ]);
  });

  it("renames a saved flow and updates its timestamp", () => {
    const flow = createSavedFlow("Untitled", graph, 100);

    expect(renameSavedFlow([flow], flow.id, "벽체 자동 배치", 500)[0]).toMatchObject({
      id: flow.id,
      name: "벽체 자동 배치",
      createdAt: 100,
      updatedAt: 500
    });
  });

  it("duplicates and removes flows", () => {
    const flow: SavedCustomFlow = createSavedFlow("원본", graph, 100);
    const duplicated = duplicateSavedFlow([flow], flow.id, 200);

    expect(duplicated).toHaveLength(2);
    expect(duplicated[0].name).toBe("원본 복사본");
    expect(removeSavedFlow(duplicated, flow.id).map((item) => item.name)).toEqual(["원본 복사본"]);
  });
  it("lists shared and saved flows as direct workflow menu items", () => {
    const shared = createSavedFlow("Shared CAD flow", graph, 100);
    const savedOld = createSavedFlow("Saved old", graph, 200);
    const savedNew = createSavedFlow("Saved new", graph, 300);

    const items = listWorkflowMenuFlowItems([shared], [savedOld, savedNew]);

    expect(items.map((item) => item.label)).toEqual([
      "Shared CAD flow",
      "Saved new",
      "Saved old"
    ]);
    expect(items.map((item) => item.id)).toEqual([
      workflowMenuFlowId("shared", shared.id),
      workflowMenuFlowId("saved", savedNew.id),
      workflowMenuFlowId("saved", savedOld.id)
    ]);
  });

  it("parses workflow menu flow ids", () => {
    expect(parseWorkflowMenuFlowId(workflowMenuFlowId("shared", "flow-a"))).toEqual({
      source: "shared",
      flowId: "flow-a"
    });
    expect(parseWorkflowMenuFlowId("add")).toBeNull();
  });

  it("updates saved flow name and description from the home page", () => {
    const flow = createSavedFlow("Old name", graph, 100, "Old description");
    const updated = updateSavedFlowDetails([flow], flow.id, {
      name: "New name",
      description: "New description"
    }, 300);

    expect(updated[0]).toMatchObject({
      id: flow.id,
      name: "New name",
      description: "New description",
      updatedAt: 300
    });
  });

  it("updates a saved flow graph and detects unsaved graph changes", () => {
    const flow = createSavedFlow("Flow", graph, 100);
    const changedGraph = { ...graph, pan: { x: 10, y: 20 } };
    const updated = updateSavedFlowGraph([flow], flow.id, changedGraph, 300);

    expect(updated[0].graph.pan).toEqual({ x: 10, y: 20 });
    expect(updated[0].updatedAt).toBe(300);
    expect(isStoredFlowGraphDirty(flow.graph, changedGraph)).toBe(true);
    expect(isStoredFlowGraphDirty(changedGraph, changedGraph)).toBe(false);
  });
});
