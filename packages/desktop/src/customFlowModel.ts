import { sidebarSections, type SidebarSectionId } from "./navigationModel";
import type { AppIconName } from "./uiIcons";
import {
  defaultToolRuntimeSchema,
  flowPortTypeFromToolType,
  type ToolRuntimeSchema,
  type ToolSettingValue
} from "./toolSettingsSchema";

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
  settingsSchema?: ToolRuntimeSchema;
}

export interface FlowNode extends FlowTool {
  nodeId: string;
  x: number;
  y: number;
  promptText?: string;
  attachedToNodeId?: string;
  activeFileSelections?: FlowActiveFileSelection[];
  pathSelection?: FlowPathSelection;
  settings?: FlowNodeSettings;
  settingsValues?: Record<string, ToolSettingValue>;
}

export interface FlowNodeSettings {
  target: string;
  options: string;
  memo: string;
}

export interface FlowActiveFileSelection {
  id: string;
  label: string;
  program: "cad" | "revit" | "excel" | "tekla";
  path: string;
}

export interface FlowPathSelection {
  name: string;
  path: string;
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
  settingsSchema?: ToolRuntimeSchema;
}

const activeFileProgramOutputMeta: Record<
  FlowActiveFileSelection["program"],
  { label: string; type: FlowPortType; iconName: AppIconName }
> = {
  cad: { label: "CAD", type: "cad", iconName: "cad" },
  revit: { label: "Revit", type: "revit", iconName: "revit" },
  excel: { label: "Excel", type: "excel", iconName: "excel" },
  tekla: { label: "Tekla", type: "object", iconName: "tekla" }
};

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
    ],
    settingsSchema: {
      ...defaultToolRuntimeSchema,
      risk: "read",
      executionMode: "mcp",
      requiredServers: ["cad"],
      mcpCommands: [
        {
          server: "cad",
          command: "cad.read_objects",
          status: "available",
          params: {
            scope: "settings.selection_scope",
            objectTypes: "settings.object_types",
            unit: "settings.unit",
            tolerance: "settings.tolerance"
          }
        }
      ],
      settingsLayout: {
        mode: "sections",
        sections: [
          { id: "input", label: "입력", defaultOpen: true },
          { id: "filter", label: "필터", defaultOpen: true },
          { id: "advanced", label: "고급 설정", defaultOpen: false }
        ]
      },
      settings: [
        {
          id: "selection_scope",
          label: "선택 범위",
          type: "scope-picker",
          required: true,
          default: "current_selection",
          description: "읽어올 CAD 객체 범위를 선택합니다.",
          section: "input",
          preview: true
        },
        {
          id: "object_types",
          label: "객체 타입",
          type: "multi-select",
          required: true,
          default: ["line", "polyline", "block", "text"],
          description: "수집할 CAD 객체 종류입니다.",
          section: "filter",
          options: [
            { value: "line", label: "Line" },
            { value: "polyline", label: "Polyline" },
            { value: "block", label: "Block" },
            { value: "text", label: "Text/MText" },
            { value: "dimension", label: "Dimension" },
            { value: "hatch", label: "Hatch" }
          ],
          preview: true
        },
        {
          id: "unit",
          label: "단위",
          type: "unit",
          required: true,
          default: "mm",
          description: "좌표와 길이를 해석할 단위입니다.",
          section: "advanced",
          advanced: true
        },
        {
          id: "tolerance",
          label: "허용 오차",
          type: "tolerance",
          required: false,
          default: 0,
          description: "중복이나 근접 판정에 사용할 거리 허용 오차입니다.",
          section: "advanced",
          advanced: true
        }
      ],
      preflightChecks: [
        {
          id: "cad_connected",
          label: "CAD MCP 연결",
          severity: "error",
          message: "CAD MCP 서버가 연결되어 있어야 합니다.",
          blocksExecution: true
        }
      ],
      resultSchema: {
        type: "table",
        fields: [
          { id: "handle", label: "객체 핸들", type: "text" },
          { id: "layer", label: "레이어", type: "text" },
          { id: "x", label: "X 좌표", type: "number" },
          { id: "y", label: "Y 좌표", type: "number" }
        ]
      }
    }
  },
  {
    id: "excel-export",
    programIcon: "excel",
    name: "Excel 내보내기",
    description: "앞 노드의 결과값을 Excel 표 형식으로 정리합니다.",
    inputs: [makeFlowPort("objects", "객체", "object")],
    outputs: [makeFlowPort("excel-file", "Excel", "excel")],
    settingsSchema: {
      ...defaultToolRuntimeSchema,
      risk: "create",
      executionMode: "mcp",
      requiredServers: ["excel"],
      mcpCommands: [
        {
          server: "excel",
          command: "excel.write_table",
          status: "planned",
          params: {
            source: "previous.result",
            outputFolder: "settings.export_path",
            fileName: "settings.file_name_template",
            overwritePolicy: "settings.overwrite_policy"
          }
        }
      ],
      settingsLayout: {
        mode: "sections",
        sections: [
          { id: "output", label: "결과", defaultOpen: true },
          { id: "advanced", label: "고급 설정", defaultOpen: false }
        ]
      },
      settings: [
        {
          id: "export_path",
          label: "저장 경로",
          type: "folder",
          required: true,
          default: "ask_on_run",
          description: "Excel 파일을 저장할 폴더입니다. 기본값은 실행할 때 선택입니다.",
          section: "output",
          preview: true
        },
        {
          id: "file_name_template",
          label: "파일명 규칙",
          type: "naming-template",
          required: true,
          default: "mcp_result_{date}.xlsx",
          description: "저장할 Excel 파일명 규칙입니다.",
          section: "output",
          preview: true
        },
        {
          id: "overwrite_policy",
          label: "기존 파일 처리",
          type: "overwrite-policy",
          required: true,
          default: "rename",
          description: "같은 이름의 파일이 있을 때 처리 방식입니다.",
          section: "advanced",
          advanced: true,
          confirmOnChange: true
        }
      ],
      preflightChecks: [
        {
          id: "output_folder_exists",
          label: "저장 폴더 확인",
          severity: "error",
          message: "Excel 파일을 저장할 폴더가 필요합니다.",
          blocksExecution: true
        }
      ],
      resultSchema: {
        type: "file",
        fields: [{ id: "path", label: "Excel 파일 경로", type: "file" }]
      }
    }
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
    outputs: [makeFlowPort("revit-elements", "Revit", "revit")],
    settingsSchema: {
      ...defaultToolRuntimeSchema,
      risk: "modify",
      executionMode: "mcp",
      requiredServers: ["revit"],
      mcpCommands: [
        {
          server: "revit",
          command: "revit.place_elements",
          status: "planned",
          params: {
            familyType: "settings.family_type",
            level: "settings.level",
            parameterMapping: "settings.parameter_mapping",
            transactionPolicy: "settings.transaction_policy"
          }
        }
      ],
      settingsLayout: {
        mode: "sections",
        sections: [
          { id: "input", label: "입력", defaultOpen: true },
          { id: "mapping", label: "매핑", defaultOpen: true },
          { id: "safety", label: "안전 확인", defaultOpen: true }
        ]
      },
      settings: [
        {
          id: "family_type",
          label: "패밀리 타입",
          type: "family-type",
          required: true,
          default: "",
          description: "배치하거나 수정할 Revit 패밀리 타입입니다.",
          section: "input",
          preview: true
        },
        {
          id: "level",
          label: "레벨",
          type: "level",
          required: true,
          default: "",
          description: "요소를 배치할 기준 레벨입니다.",
          section: "input",
          preview: true
        },
        {
          id: "parameter_mapping",
          label: "파라미터 매핑",
          type: "mapping-table",
          required: false,
          default: [],
          description: "Excel 열과 Revit 파라미터를 연결합니다.",
          section: "mapping"
        },
        {
          id: "transaction_policy",
          label: "실패 처리",
          type: "transaction-policy",
          required: true,
          default: "rollback_all",
          description: "실패했을 때 Revit 변경을 어떻게 처리할지 정합니다.",
          section: "safety",
          confirmOnChange: true
        }
      ],
      preflightChecks: [
        {
          id: "revit_model_open",
          label: "Revit 모델 열림",
          severity: "error",
          message: "Revit 모델이 열려 있어야 합니다.",
          blocksExecution: true
        }
      ],
      resultSchema: {
        type: "revit_element_ids",
        fields: [{ id: "element_id", label: "Revit 요소 ID", type: "text" }]
      }
    }
  }
];

export function flowNodeDisplayIconName(node: FlowNode): AppIconName {
  if (node.id === "basic-custom-prompt") {
    return node.attachedToNodeId ? "promptAttached" : "promptDetached";
  }
  if (node.id === "basic-active-file") {
    const programs = Array.from(
      new Set((node.activeFileSelections ?? []).map((selection) => selection.program))
    );
    if (programs.length === 1) {
      return programs[0];
    }
    return "activeFileUnknown";
  }

  return node.programIcon;
}

export function activeFileOutputPortForSelections(
  selections: FlowActiveFileSelection[] = []
): FlowPort {
  const programs = Array.from(new Set(selections.map((selection) => selection.program)));
  if (programs.length === 1) {
    const meta = activeFileProgramOutputMeta[programs[0]];
    return makeFlowPort("active-file", meta.label, meta.type, meta.iconName);
  }

  return makeFlowPort("active-file", "활성 파일", "file", "activeFileUnknown");
}

export function withActiveFileOutputPort(node: FlowNode): FlowNode {
  if (node.id !== "basic-active-file") {
    return node;
  }

  return {
    ...node,
    outputs: [activeFileOutputPortForSelections(node.activeFileSelections)]
  };
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
  if (port === "number" || port === "coordinate" || port === "boolean") {
    return "numberData";
  }
  if (port === "text") {
    return "textData";
  }
  if (port === "table") {
    return "excel";
  }
  if (port === "file") {
    return "customTools";
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
    inputs: submenu.settingsSchema?.inputs.length
      ? submenu.settingsSchema.inputs.map((port, index) =>
          makeFlowPort(port.id || `input-${index}`, port.label, flowPortTypeFromToolType(port.type), programIcon)
        )
      : [makeFlowPort("input", sidebarLabel(sectionId), baseType, programIcon)],
    outputs: submenu.settingsSchema?.outputs.length
      ? submenu.settingsSchema.outputs.map((port, index) =>
          makeFlowPort(port.id || `output-${index}`, port.label, flowPortTypeFromToolType(port.type), programIcon)
        )
      : [makeFlowPort("result", "결과", "any", programIcon)],
    settingsSchema: submenu.settingsSchema
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
        : [makeFlowPort("result", "결과", "any")],
      settingsSchema: parsed.settingsSchema
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
    outputs: tool.outputs.map((port) => ({ ...port })),
    settingsSchema: tool.settingsSchema ? { ...tool.settingsSchema } : undefined
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

export function removeNodeIdsFromFlowGroups(groups: FlowGroup[], nodeIds: string[]) {
  const removeSet = new Set(nodeIds);

  return groups
    .map((group) => ({
      ...group,
      nodeIds: group.nodeIds.filter((nodeId) => !removeSet.has(nodeId))
    }))
    .filter((group) => group.nodeIds.length > 0);
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function insertStoredFlowGraphAsGroup(
  snapshot: FlowSnapshot,
  graph: StoredFlowGraph,
  options: {
    flowName: string;
    x: number;
    y: number;
    now?: number;
    color?: string;
  }
): FlowSnapshot {
  if (graph.nodes.length === 0) {
    return snapshot;
  }

  const stamp = options.now ?? Date.now();
  const minX = Math.min(...graph.nodes.map((node) => node.x));
  const minY = Math.min(...graph.nodes.map((node) => node.y));
  const nodeIdMap = new Map<string, string>();
  const importedNodeIds: string[] = [];

  const nodes = graph.nodes.map((sourceNode) => {
    const nodeId = `import-${stamp}-${sourceNode.nodeId}`;
    nodeIdMap.set(sourceNode.nodeId, nodeId);
    importedNodeIds.push(nodeId);

    return {
      ...cloneJson(sourceNode),
      nodeId,
      x: options.x + (sourceNode.x - minX),
      y: options.y + (sourceNode.y - minY)
    };
  });

  const connections = graph.connections
    .map((connection) => {
      const fromNodeId = nodeIdMap.get(connection.fromNodeId);
      const toNodeId = nodeIdMap.get(connection.toNodeId);
      if (!fromNodeId || !toNodeId) {
        return null;
      }

      return {
        ...cloneJson(connection),
        id: `import-${stamp}-${connection.id}`,
        fromNodeId,
        toNodeId
      };
    })
    .filter((connection): connection is FlowConnection => Boolean(connection));

  const notes = (graph.notes ?? []).map((note, index) => ({
    ...cloneJson(note),
    id: `import-${stamp}-${note.id || `note-${index}`}`,
    x: options.x + (note.x - minX),
    y: options.y + (note.y - minY)
  }));

  return {
    nodes: [...snapshot.nodes, ...nodes],
    connections: [...snapshot.connections, ...connections],
    groups: [
      ...snapshot.groups,
      {
        id: `group-import-${stamp}`,
        name: options.flowName.trim() || "Imported Flow",
        color: options.color ?? "#bfdbfe",
        nodeIds: importedNodeIds
      }
    ],
    notes: [...snapshot.notes, ...notes]
  };
}

export function normalizeStoredBasicFlowNode(node: FlowNode): FlowNode {
  if (node.id === "basic-result-preview") {
    return {
      ...node,
      programIcon: "preview",
      name: "결과 미리보기",
      description: "앞 노드의 결과를 이 노드 안에서 바로 확인합니다.",
      inputs: node.inputs.filter((port) => port.id === "result"),
      outputs: []
    };
  }

  if (node.id === "basic-path-select") {
    return {
      ...node,
      programIcon: "folder",
      name: "경로 지정",
      description: "파일이나 폴더 경로를 다음 노드 입력값으로 전달합니다.",
      inputs: [],
      outputs: node.outputs.length > 0
        ? node.outputs.filter((port) => port.id === "path")
        : [makeFlowPort("path", "경로", "text", "textData")]
    };
  }

  if (node.id === "basic-active-file") {
    return withActiveFileOutputPort({
      ...node,
      programIcon: "activeFileUnknown",
      name: "활성 파일",
      description: "CAD, Excel, Revit처럼 현재 열려 있는 파일을 입력값으로 사용합니다.",
      inputs: []
    });
  }

  if (node.id === "basic-custom-prompt") {
    return {
      ...node,
      programIcon: node.attachedToNodeId ? "promptAttached" : "promptDetached",
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
            typeof node.attachedToNodeId === "string" ? node.attachedToNodeId : undefined,
          activeFileSelections: Array.isArray(node.activeFileSelections)
            ? node.activeFileSelections
                .map((selection) => ({
                  id: String(selection.id ?? ""),
                  label: String(selection.label ?? ""),
                  program: selection.program,
                  path: String(selection.path ?? "")
                }))
                .filter((selection) =>
                  selection.id &&
                  selection.label &&
                  ["cad", "revit", "excel", "tekla"].includes(selection.program)
                )
            : undefined,
          pathSelection:
            node.pathSelection && typeof node.pathSelection === "object"
              ? {
                  name: String(node.pathSelection.name ?? ""),
                  path: String(node.pathSelection.path ?? "")
                }
              : undefined,
          settings:
            node.settings && typeof node.settings === "object"
              ? {
                  target: String(node.settings.target ?? ""),
                  options: String(node.settings.options ?? ""),
                  memo: String(node.settings.memo ?? "")
                }
              : undefined,
          settingsSchema:
            node.settingsSchema && typeof node.settingsSchema === "object"
              ? (node.settingsSchema as ToolRuntimeSchema)
              : toolDefaults?.settingsSchema,
          settingsValues:
            node.settingsValues && typeof node.settingsValues === "object"
              ? (node.settingsValues as Record<string, ToolSettingValue>)
              : undefined
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
