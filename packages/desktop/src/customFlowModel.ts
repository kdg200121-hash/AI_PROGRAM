import { sidebarSections, type SidebarSectionId } from "./navigationModel";
import type { AppIconName } from "./uiIcons";

export const customFlowGraphStorageKey = "mcp-registry:custom-flow-graph";

export type FlowPortType =
  | "cad"
  | "revit"
  | "excel"
  | "object"
  | "number"
  | "text"
  | "coordinate"
  | "table"
  | "file"
  | "boolean"
  | "any";

export interface FlowPort {
  id: string;
  label: string;
  type: FlowPortType;
  iconName: AppIconName;
  custom?: boolean;
}

export interface FlowTool {
  id: string;
  programIcon: AppIconName;
  name: string;
  description: string;
  inputs: FlowPort[];
  outputs: FlowPort[];
}

export interface FlowNode extends FlowTool {
  nodeId: string;
  x: number;
  y: number;
  promptText?: string;
  attachedToNodeId?: string;
}

export interface FlowConnection {
  id: string;
  fromNodeId: string;
  fromPortId: string;
  toNodeId: string;
  toPortId: string;
}

export interface FlowGroup {
  id: string;
  name: string;
  color: string;
  nodeIds: string[];
}

export interface FlowNote {
  id: string;
  title?: string;
  text: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  color?: string;
}

export interface FlowSnapshot {
  nodes: FlowNode[];
  connections: FlowConnection[];
  groups: FlowGroup[];
  notes: FlowNote[];
}

export interface StoredFlowGraph {
  nodes: FlowNode[];
  connections: FlowConnection[];
  groups?: FlowGroup[];
  notes?: FlowNote[];
  scale: number;
  pan: { x: number; y: number };
}

interface FlowSubmenuItem {
  id: string;
  label: string;
  description: string;
}

function sidebarLabel(sectionId: SidebarSectionId) {
  return sidebarSections.find((section) => section.id === sectionId)?.label ?? "Unknown";
}

function makeFlowPort(
  id: string,
  label: string,
  type: FlowPortType,
  iconName = flowPortIconName(type),
  custom = false
): FlowPort {
  return { id, label, type, iconName, custom };
}

export const flowToolPalette: FlowTool[] = [
  {
    id: "cad-read",
    programIcon: "cad",
    name: "CAD 객체 읽기",
    description: "선, 문자, 블록 같은 CAD 객체를 읽어 다음 노드로 전달합니다.",
    inputs: [makeFlowPort("cad-source", "CAD", "cad")],
    outputs: [
      makeFlowPort("objects", "객체", "object"),
      makeFlowPort("excel-table", "Excel", "excel")
    ]
  },
  {
    id: "excel-export",
    programIcon: "excel",
    name: "Excel 내보내기",
    description: "앞 노드의 결과값을 Excel 표 형식으로 정리합니다.",
    inputs: [makeFlowPort("objects", "객체", "object")],
    outputs: [makeFlowPort("excel-file", "Excel", "excel")]
  },
  {
    id: "revit-place",
    programIcon: "revit",
    name: "Revit 배치",
    description: "좌표와 매핑 정보를 받아 Revit 요소 배치 명령을 준비합니다.",
    inputs: [
      makeFlowPort("excel-file", "Excel", "excel"),
      makeFlowPort("coordinates", "좌표", "number")
    ],
    outputs: [makeFlowPort("revit-elements", "Revit", "revit")]
  }
];

export function flowNodeDisplayIconName(node: FlowNode): AppIconName {
  if (node.id === "basic-custom-prompt") {
    return node.attachedToNodeId ? "promptAttached" : "promptDetached";
  }

  return node.programIcon;
}

export function defaultFlowNodePosition(index: number) {
  return {
    x: 48 + index * 396,
    y: 92 + (index % 2) * 150
  };
}

export const flowNodeWidth = 348;

export function flowPortIconName(port: string): AppIconName {
  if (port === "Excel" || port === "excel") {
    return "excel";
  }
  if (port === "Revit" || port === "revit") {
    return "revit";
  }
  if (port === "CAD" || port === "cad") {
    return "cad";
  }
  if (port === "object") {
    return "objectData";
  }
  if (port === "number") {
    return "numberData";
  }
  if (port === "text") {
    return "textData";
  }
  if (port === "coordinate") {
    return "numberData";
  }
  if (port === "table") {
    return "excel";
  }
  if (port === "file") {
    return "customTools";
  }
  if (port === "boolean") {
    return "numberData";
  }
  return "customTools";
}

function flowProgramIconForSection(sectionId: SidebarSectionId): AppIconName {
  if (sectionId === "revit") {
    return "revit";
  }
  if (sectionId === "excel") {
    return "excel";
  }
  if (sectionId === "tekla") {
    return "tekla";
  }
  if (sectionId === "workflow") {
    return "workflow";
  }
  return "cad";
}

function flowTypeForSection(sectionId: SidebarSectionId): FlowPortType {
  if (sectionId === "revit") {
    return "revit";
  }
  if (sectionId === "excel") {
    return "excel";
  }
  if (sectionId === "tekla") {
    return "object";
  }
  return "cad";
}

function flowToolFromMenuItem(sectionId: SidebarSectionId, submenu: FlowSubmenuItem): FlowTool {
  const labelMatch = flowToolPalette.find((tool) => tool.name === submenu.label);
  if (labelMatch) {
    return labelMatch;
  }

  const baseType = flowTypeForSection(sectionId);
  const programIcon = flowProgramIconForSection(sectionId);
  const normalizedId = `${sectionId}-${submenu.id}`.replace(/[^a-z0-9_-]/gi, "-");

  return {
    id: `menu-${normalizedId}`,
    programIcon,
    name: submenu.label,
    description: submenu.description,
    inputs: [makeFlowPort("input", sidebarLabel(sectionId), baseType, programIcon)],
    outputs: [makeFlowPort("result", "결과", "any", programIcon)]
  };
}

export function flowToolIdFromMenuItem(sectionId: SidebarSectionId, submenu: FlowSubmenuItem) {
  const labelMatch = flowToolPalette.find((tool) => tool.name === submenu.label);
  if (labelMatch) {
    return labelMatch.id;
  }

  if (submenu.id.includes("excel")) {
    return "excel-export";
  }
  if (sectionId === "revit" || submenu.id.includes("revit")) {
    return "revit-place";
  }
  if (sectionId === "servers" || sectionId === "workflow" || submenu.id.includes("cad")) {
    return "cad-read";
  }

  return "";
}

export function serializeFlowToolForDrag(sectionId: SidebarSectionId, submenu: FlowSubmenuItem) {
  return JSON.stringify(flowToolFromMenuItem(sectionId, submenu));
}

export function parseDraggedFlowTool(raw: string): FlowTool | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<FlowTool>;
    if (!parsed.id || !parsed.name) {
      return null;
    }

    return {
      id: String(parsed.id),
      programIcon: parsed.programIcon ?? "customTools",
      name: String(parsed.name),
      description: String(parsed.description ?? ""),
      inputs: Array.isArray(parsed.inputs)
        ? parsed.inputs.map((port, index) => normalizeFlowPort(port, `input-${index}`))
        : [makeFlowPort("input", "입력", "any")],
      outputs: Array.isArray(parsed.outputs)
        ? parsed.outputs.map((port, index) => normalizeFlowPort(port, `output-${index}`))
        : [makeFlowPort("result", "결과", "any")]
    };
  } catch {
    return null;
  }
}

function normalizeFlowPort(port: Partial<FlowPort> | string, fallbackId: string): FlowPort {
  if (typeof port === "string") {
    return makeFlowPort(fallbackId, port, "any", flowPortIconName(port));
  }

  const type = port.type ?? "any";
  return makeFlowPort(
    String(port.id ?? fallbackId),
    String(port.label ?? port.id ?? fallbackId),
    type,
    port.iconName ?? flowPortIconName(type),
    Boolean(port.custom)
  );
}

export function cloneFlowTool(tool: FlowTool): FlowTool {
  return {
    ...tool,
    inputs: tool.inputs.map((port) => ({ ...port })),
    outputs: tool.outputs.map((port) => ({ ...port }))
  };
}

export function applyFlowNodeDrag(
  nodes: FlowNode[],
  origins: { nodeId: string; x: number; y: number }[],
  delta: { x: number; y: number }
) {
  const originMap = new Map(origins.map((origin) => [origin.nodeId, origin]));

  return nodes.map((node) => {
    const origin = originMap.get(node.nodeId);
    return origin ? { ...node, x: origin.x + delta.x, y: origin.y + delta.y } : node;
  });
}

export function normalizeStoredBasicFlowNode(node: FlowNode): FlowNode {
  if (node.id === "basic-result-preview") {
    return {
      ...node,
      name: "결과 미리보기",
      description: "앞 노드의 결과를 이 노드 안에서 바로 확인합니다.",
      inputs: node.inputs.filter((port) => port.id === "result"),
      outputs: []
    };
  }

  if (node.id === "basic-path-select") {
    return {
      ...node,
      name: "경로 지정",
      description: "파일이나 폴더 경로를 다음 노드 입력값으로 전달합니다.",
      inputs: [],
      outputs: node.outputs.length > 0
        ? node.outputs.filter((port) => port.id === "path")
        : [makeFlowPort("path", "경로", "text", "textData")]
    };
  }

  if (node.id === "basic-active-file") {
    return {
      ...node,
      name: "활성 파일",
      description: "CAD, Excel, Revit처럼 현재 열려 있는 파일을 입력값으로 사용합니다.",
      inputs: [],
      outputs: [makeFlowPort("active-file", "활성 파일", "file", "customTools")]
    };
  }

  if (node.id === "basic-custom-prompt") {
    return {
      ...node,
      name: "프롬프트",
      description: "노드 아래에 붙여 실행 프롬프트에 문장을 추가합니다.",
      inputs: [],
      outputs: [],
      promptText: node.promptText ?? ""
    };
  }

  return node;
}

export function defaultFlowNodes() {
  return [
    { ...cloneFlowTool(flowToolPalette[0]), nodeId: "node-cad-read", ...defaultFlowNodePosition(0) },
    { ...cloneFlowTool(flowToolPalette[1]), nodeId: "node-excel-export", ...defaultFlowNodePosition(1) }
  ];
}

export function defaultFlowConnections(): FlowConnection[] {
  return [
    {
      id: "conn-cad-read-objects-excel-export",
      fromNodeId: "node-cad-read",
      fromPortId: "objects",
      toNodeId: "node-excel-export",
      toPortId: "objects"
    }
  ];
}

export function loadStoredFlowGraph(): StoredFlowGraph | null {
  try {
    const raw = window.localStorage.getItem(customFlowGraphStorageKey);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<StoredFlowGraph>;
    if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.connections)) {
      return null;
    }

    return {
      nodes: parsed.nodes.map((node, index) => {
        const id = String(node.id ?? `stored-${index}`);
        const paletteTool = flowToolPalette.find((tool) => tool.id === id);
        const toolDefaults = paletteTool ? cloneFlowTool(paletteTool) : null;

        return normalizeStoredBasicFlowNode({
          id,
          programIcon: toolDefaults?.programIcon ?? node.programIcon ?? "customTools",
          name: toolDefaults?.name ?? String(node.name ?? `Node ${index + 1}`),
          description: toolDefaults?.description ?? String(node.description ?? ""),
          inputs: toolDefaults?.inputs ?? (
            Array.isArray(node.inputs)
              ? node.inputs.map((port, portIndex) => normalizeFlowPort(port, `input-${portIndex}`))
              : [makeFlowPort("input", "입력", "any")]
          ),
          outputs: toolDefaults?.outputs ?? (
            Array.isArray(node.outputs)
              ? node.outputs.map((port, portIndex) => normalizeFlowPort(port, `output-${portIndex}`))
              : [makeFlowPort("result", "결과", "any")]
          ),
          nodeId: String(node.nodeId ?? `stored-node-${index}`),
          x: Number(node.x ?? defaultFlowNodePosition(index).x),
          y: Number(node.y ?? defaultFlowNodePosition(index).y),
          promptText: typeof node.promptText === "string" ? node.promptText : undefined,
          attachedToNodeId:
            typeof node.attachedToNodeId === "string" ? node.attachedToNodeId : undefined
        });
      }),
      connections: parsed.connections
        .map((connection, index) => ({
          id: String(connection.id ?? `stored-connection-${index}`),
          fromNodeId: String(connection.fromNodeId ?? ""),
          fromPortId: String(connection.fromPortId ?? ""),
          toNodeId: String(connection.toNodeId ?? ""),
          toPortId: String(connection.toPortId ?? "")
        }))
        .filter((connection) => connection.fromNodeId && connection.toNodeId),
      groups: Array.isArray(parsed.groups)
        ? parsed.groups
            .map((group, index) => ({
              id: String(group.id ?? `stored-group-${index}`),
              name: String(group.name ?? `Group ${index + 1}`),
              color: String(group.color ?? "#bfdbfe"),
              nodeIds: Array.isArray(group.nodeIds) ? group.nodeIds.map(String) : []
            }))
            .filter((group) => group.nodeIds.length > 0)
        : [],
      notes: Array.isArray(parsed.notes)
        ? parsed.notes
            .map((note, index) => ({
              id: String(note.id ?? `stored-note-${index}`),
              title: String(note.title ?? "메모"),
              text: String(note.text ?? "메모"),
              x: Number(note.x ?? defaultFlowNodePosition(index).x),
              y: Number(note.y ?? defaultFlowNodePosition(index).y),
              width: Number(note.width ?? 220),
              height: Number(note.height ?? 140),
              color: String(note.color ?? "#fff7c7")
            }))
            .filter((note) => Number.isFinite(note.x) && Number.isFinite(note.y))
        : [],
      scale: Number(parsed.scale ?? 1),
      pan: {
        x: Number(parsed.pan?.x ?? 0),
        y: Number(parsed.pan?.y ?? 0)
      }
    };
  } catch {
    return null;
  }
}

export function isFlowTypeCompatible(output?: FlowPort, input?: FlowPort) {
  if (!output || !input) {
    return false;
  }
  return output.type === "any" || input.type === "any" || output.type === input.type;
}

export function flowPortLocalY(node: FlowNode, direction: "input" | "output", portId: string) {
  const ports = direction === "input" ? node.inputs : node.outputs;
  const index = Math.max(0, ports.findIndex((port) => port.id === portId));
  return 92 + index * 36;
}

const flowPortConnectorCenterOffset = 2;

export function flowConnectionEndpoint(
  node: FlowNode,
  direction: "input" | "output",
  portId: string
) {
  return {
    x:
      direction === "output"
        ? node.x + flowNodeWidth - flowPortConnectorCenterOffset
        : node.x + flowPortConnectorCenterOffset,
    y: node.y + flowPortLocalY(node, direction, portId)
  };
}
