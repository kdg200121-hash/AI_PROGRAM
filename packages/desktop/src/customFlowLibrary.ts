import {
  defaultFlowConnections,
  defaultFlowNodes,
  type StoredFlowGraph
} from "./customFlowModel";

export const savedCustomFlowsStorageKey = "mcp-registry:saved-custom-flows";

export interface SavedCustomFlow {
  id: string;
  name: string;
  description: string;
  graph: StoredFlowGraph;
  createdAt: number;
  updatedAt: number;
}

export function createSavedFlow(
  name: string,
  graph: StoredFlowGraph,
  now = Date.now(),
  description = "Custom Flow 작업 흐름"
): SavedCustomFlow {
  return {
    id: `flow-${now}-${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim() || "새 Custom Flow",
    description,
    graph,
    createdAt: now,
    updatedAt: now
  };
}

export function listSavedFlows(flows: SavedCustomFlow[]) {
  return [...flows].sort((left, right) => right.updatedAt - left.updatedAt);
}

export type WorkflowMenuFlowSource = "shared" | "saved";

export interface WorkflowMenuFlowItem {
  id: string;
  flowId: string;
  source: WorkflowMenuFlowSource;
  label: string;
  description: string;
  flow: SavedCustomFlow;
}

export function workflowMenuFlowId(source: WorkflowMenuFlowSource, flowId: string) {
  return `${source}-flow:${flowId}`;
}

export function parseWorkflowMenuFlowId(submenuId: string): {
  source: WorkflowMenuFlowSource;
  flowId: string;
} | null {
  const match = /^(shared|saved)-flow:(.+)$/.exec(submenuId);
  if (!match) {
    return null;
  }

  return {
    source: match[1] as WorkflowMenuFlowSource,
    flowId: match[2]
  };
}

export function listWorkflowMenuFlowItems(
  sharedFlows: SavedCustomFlow[],
  savedFlows: SavedCustomFlow[]
): WorkflowMenuFlowItem[] {
  return [
    ...sharedFlows.map((flow) => ({
      id: workflowMenuFlowId("shared", flow.id),
      flowId: flow.id,
      source: "shared" as const,
      label: flow.name,
      description: flow.description,
      flow
    })),
    ...listSavedFlows(savedFlows).map((flow) => ({
      id: workflowMenuFlowId("saved", flow.id),
      flowId: flow.id,
      source: "saved" as const,
      label: flow.name,
      description: flow.description,
      flow
    }))
  ];
}

export function renameSavedFlow(
  flows: SavedCustomFlow[],
  flowId: string,
  name: string,
  now = Date.now()
) {
  return flows.map((flow) =>
    flow.id === flowId
      ? {
          ...flow,
          name: name.trim() || flow.name,
          updatedAt: now
        }
      : flow
  );
}

export function updateSavedFlowDetails(
  flows: SavedCustomFlow[],
  flowId: string,
  patch: { name?: string; description?: string },
  now = Date.now()
) {
  return flows.map((flow) =>
    flow.id === flowId
      ? {
          ...flow,
          name: patch.name?.trim() || flow.name,
          description: patch.description ?? flow.description,
          updatedAt: now
        }
      : flow
  );
}

export function updateSavedFlowGraph(
  flows: SavedCustomFlow[],
  flowId: string,
  graph: StoredFlowGraph,
  now = Date.now()
) {
  return flows.map((flow) =>
    flow.id === flowId
      ? {
          ...flow,
          graph: cloneStoredFlowGraph(graph),
          updatedAt: now
        }
      : flow
  );
}

export function isStoredFlowGraphDirty(
  savedGraph: StoredFlowGraph | null | undefined,
  currentGraph: StoredFlowGraph
) {
  if (!savedGraph) {
    return false;
  }
  return JSON.stringify(savedGraph) !== JSON.stringify(currentGraph);
}

export function duplicateSavedFlow(flows: SavedCustomFlow[], flowId: string, now = Date.now()) {
  const source = flows.find((flow) => flow.id === flowId);
  if (!source) {
    return flows;
  }

  return [
    {
      ...source,
      id: `flow-${now}-${Math.random().toString(36).slice(2, 8)}`,
      name: `${source.name} 복사본`,
      createdAt: now,
      updatedAt: now,
      graph: cloneStoredFlowGraph(source.graph)
    },
    ...flows
  ];
}

export function removeSavedFlow(flows: SavedCustomFlow[], flowId: string) {
  return flows.filter((flow) => flow.id !== flowId);
}

export function cloneStoredFlowGraph(graph: StoredFlowGraph): StoredFlowGraph {
  return JSON.parse(JSON.stringify(graph)) as StoredFlowGraph;
}

export function loadSavedFlows(storage: Storage = window.localStorage): SavedCustomFlow[] {
  try {
    const raw = storage.getItem(savedCustomFlowsStorageKey);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item): SavedCustomFlow | null => {
        if (!item || typeof item !== "object" || !item.graph) {
          return null;
        }
        return {
          id: String(item.id ?? ""),
          name: String(item.name ?? "Custom Flow"),
          description: String(item.description ?? "Custom Flow 작업 흐름"),
          graph: item.graph as StoredFlowGraph,
          createdAt: Number(item.createdAt ?? Date.now()),
          updatedAt: Number(item.updatedAt ?? item.createdAt ?? Date.now())
        };
      })
      .filter((item): item is SavedCustomFlow => Boolean(item?.id && item.name));
  } catch {
    return [];
  }
}

export function saveSavedFlows(flows: SavedCustomFlow[], storage: Storage = window.localStorage) {
  storage.setItem(savedCustomFlowsStorageKey, JSON.stringify(flows));
}

function sampleGraph(): StoredFlowGraph {
  return {
    nodes: defaultFlowNodes(),
    connections: defaultFlowConnections(),
    groups: [],
    notes: [],
    scale: 1,
    pan: { x: 0, y: 0 }
  };
}

export const sampleSharedFlows: SavedCustomFlow[] = [
  createSavedFlow(
    "CAD 객체 읽기 후 Excel 정리",
    sampleGraph(),
    1,
    "CAD 객체 정보를 읽어 Excel 보고서로 정리하는 샘플 플로우입니다."
  ),
  createSavedFlow(
    "CAD 좌표 기반 Revit 배치",
    sampleGraph(),
    2,
    "CAD 좌표와 객체 정보를 Revit 배치 작업으로 넘기는 샘플 플로우입니다."
  )
];
