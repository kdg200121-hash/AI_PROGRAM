import { describe, expect, it } from "vitest";
import { createGithubFlowDocument, githubFlowFileName } from "./githubFlowShare";
import type { SavedCustomFlow } from "./customFlowLibrary";

const flow: SavedCustomFlow = {
  id: "flow-1",
  name: "CAD 좌표 기반 Revit 배치",
  description: "CAD 좌표를 Revit 배치로 넘깁니다.",
  version: "1.2.0",
  author: "김동건축",
  createdAt: 100,
  updatedAt: 200,
  graph: {
    nodes: [{ nodeId: "node-a" } as never],
    connections: [],
    groups: [],
    notes: [],
    scale: 1,
    pan: { x: 0, y: 0 }
  }
};

describe("githubFlowShare", () => {
  it("creates a safe json file name for shared flows", () => {
    expect(githubFlowFileName(flow)).toBe("cad-revit-1.2.0.json");
  });

  it("serializes a saved flow with metadata and graph", () => {
    expect(createGithubFlowDocument(flow, "등록자")).toEqual({
      name: "CAD 좌표 기반 Revit 배치",
      description: "CAD 좌표를 Revit 배치로 넘깁니다.",
      version: "1.2.0",
      author: "등록자",
      createdAt: 100,
      updatedAt: 200,
      graph: flow.graph
    });
  });
});
