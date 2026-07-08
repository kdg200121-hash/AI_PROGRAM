import {
  defaultFlowConnections,
  defaultFlowNodes,
  type StoredFlowGraph
} from "./customFlowModel";

export const savedCustomFlowsStorageKey = "mcp-registry:saved-custom-flows";
export const sharedCustomFlowsStorageKey = "mcp-registry:shared-custom-flows";

export interface SavedCustomFlow {
  id: string;
  name: string;
  description: string;
  graph: StoredFlowGraph;
  createdAt: number;
  updatedAt: number;
  version?: string;
  author?: string;
  sourcePath?: string;
}

export function createSavedFlow(
  name: string,
  graph: StoredFlowGraph,
  now = Date.now(),
  description = "Custom Flow 작업 흐름",
  metadata: Partial<Pick<SavedCustomFlow, "version" | "author" | "sourcePath">> = {}
): SavedCustomFlow {
  return {
    id: `flow-${now}-${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim() || "새 Custom Flow",
    description,
    graph: cloneStoredFlowGraph(graph),
    createdAt: now,
    updatedAt: now,
    version: metadata.version,
    author: metadata.author,
    sourcePath: metadata.sourcePath
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

function normalizeSavedFlow(item: unknown): SavedCustomFlow | null {
  if (!item || typeof item !== "object" || !("graph" in item)) {
    return null;
  }

  const record = item as Partial<SavedCustomFlow>;
  const id = String(record.id ?? "");
  const name = String(record.name ?? "Custom Flow");
  if (!id || !name) {
    return null;
  }

  return {
    id,
    name,
    description: String(record.description ?? "Custom Flow 작업 흐름"),
    graph: record.graph as StoredFlowGraph,
    createdAt: Number(record.createdAt ?? Date.now()),
    updatedAt: Number(record.updatedAt ?? record.createdAt ?? Date.now()),
    version: record.version ? String(record.version) : undefined,
    author: record.author ? String(record.author) : undefined,
    sourcePath: record.sourcePath ? String(record.sourcePath) : undefined
  };
}

function parseSavedFlowList(raw: string | null): SavedCustomFlow[] {
  try {
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map(normalizeSavedFlow).filter((item): item is SavedCustomFlow => Boolean(item));
  } catch {
    return [];
  }
}

export function loadSavedFlows(storage: Storage = window.localStorage): SavedCustomFlow[] {
  return parseSavedFlowList(storage.getItem(savedCustomFlowsStorageKey));
}

export function saveSavedFlows(flows: SavedCustomFlow[], storage: Storage = window.localStorage) {
  storage.setItem(savedCustomFlowsStorageKey, JSON.stringify(flows));
}

export function loadSharedFlows(storage: Storage = window.localStorage): SavedCustomFlow[] {
  return parseSavedFlowList(storage.getItem(sharedCustomFlowsStorageKey));
}

export function saveSharedFlows(flows: SavedCustomFlow[], storage: Storage = window.localStorage) {
  storage.setItem(sharedCustomFlowsStorageKey, JSON.stringify(flows));
}

function normalizeFlowIdentityPart(value: string | undefined, fallback: string) {
  return (value?.trim() || fallback).toLocaleLowerCase();
}

export function flowRegistrationKey(flow: SavedCustomFlow) {
  return [
    normalizeFlowIdentityPart(flow.name, "custom-flow"),
    normalizeFlowIdentityPart(flow.version, "1.0.0"),
    normalizeFlowIdentityPart(flow.author, "mcp-registry")
  ].join("|");
}

export function isFlowRegistered(sharedFlows: SavedCustomFlow[], flow: SavedCustomFlow) {
  const key = flowRegistrationKey(flow);
  return sharedFlows.some((item) => item.id === flow.id || flowRegistrationKey(item) === key);
}

export function removeSharedFlowByIdentity(
  sharedFlows: SavedCustomFlow[],
  flow: SavedCustomFlow
) {
  const key = flowRegistrationKey(flow);
  return sharedFlows.filter((item) => item.id !== flow.id && flowRegistrationKey(item) !== key);
}

export function upsertSharedFlow(
  sharedFlows: SavedCustomFlow[],
  flow: SavedCustomFlow,
  now = Date.now()
) {
  const sharedFlow: SavedCustomFlow = {
    ...flow,
    graph: cloneStoredFlowGraph(flow.graph),
    version: flow.version ?? "1.0.0",
    author: flow.author ?? "MCP Registry",
    updatedAt: now
  };
  const exists = sharedFlows.some((item) => item.id === flow.id);
  return exists
    ? sharedFlows.map((item) => (item.id === flow.id ? sharedFlow : item))
    : [sharedFlow, ...sharedFlows];
}

export function upsertSharedFlowByIdentity(
  sharedFlows: SavedCustomFlow[],
  flow: SavedCustomFlow,
  now = Date.now()
) {
  const sharedFlow = upsertSharedFlow([], flow, now)[0];
  const key = flowRegistrationKey(sharedFlow);
  const exists = sharedFlows.some(
    (item) => item.id === sharedFlow.id || flowRegistrationKey(item) === key
  );
  return exists
    ? sharedFlows.map((item) =>
        item.id === sharedFlow.id || flowRegistrationKey(item) === key ? sharedFlow : item
      )
    : [sharedFlow, ...sharedFlows];
}

export function serializeSavedFlowForDrag(flow: SavedCustomFlow) {
  return JSON.stringify(flow);
}

export function parseDraggedSavedFlow(raw: string): SavedCustomFlow | null {
  if (!raw) {
    return null;
  }

  try {
    return normalizeSavedFlow(JSON.parse(raw));
  } catch {
    return null;
  }
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
    "CAD 객체 읽기 → Excel 정리",
    sampleGraph(),
    1,
    "CAD 객체 정보를 읽어 Excel 보고서로 정리하는 샘플 플로우입니다.",
    { version: "1.0.0", author: "MCP Registry" }
  ),
  createSavedFlow(
    "CAD 좌표 기반 Revit 배치",
    sampleGraph(),
    2,
    "CAD 좌표와 객체 정보를 Revit 배치 작업으로 넘기는 샘플 플로우입니다.",
    { version: "1.0.0", author: "MCP Registry" }
  )
];
