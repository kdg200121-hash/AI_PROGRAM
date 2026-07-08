import type { FlowConnection, FlowGroup, FlowNode } from "./customFlowModel";
import {
  defaultToolRuntimeSchema,
  flowPortTypeFromToolType,
  type ToolMcpCommand,
  type ToolRuntimeSchema,
  type ToolSettingField
} from "./toolSettingsSchema";
import { buildToolExecutionPlan } from "./toolRuntimeValidation";

export type FlowRunMode = "batch" | "step";
export type FlowRunScope = "all" | "selected" | "from-selected" | "to-selected";
export type FlowRunRecordStatus = "queued" | "running" | "success" | "warning" | "error";

export interface FlowNodePreview {
  title: string;
  summary: string;
  metrics: { label: string; value: string }[];
  rows: Record<string, string>[];
}

export interface FlowImpactSummary {
  title: string;
  tone: "safe" | "create" | "modify" | "danger";
  items: string[];
}

export interface FlowRunRecord {
  id: string;
  nodeId: string;
  nodeName: string;
  status: FlowRunRecordStatus;
  message: string;
  impact: FlowImpactSummary;
  preview: FlowNodePreview;
}

const riskRank: Record<ToolRuntimeSchema["risk"], number> = {
  safe: 0,
  read: 1,
  create: 2,
  caution: 3,
  modify: 4,
  "bulk-modify": 5,
  delete: 6
};

const riskTone: Record<ToolRuntimeSchema["risk"], FlowImpactSummary["tone"]> = {
  safe: "safe",
  read: "safe",
  create: "create",
  caution: "modify",
  modify: "modify",
  "bulk-modify": "modify",
  delete: "danger"
};

const riskTitle: Record<ToolRuntimeSchema["risk"], string> = {
  safe: "안전",
  read: "읽기 전용",
  create: "파일/객체 생성",
  caution: "주의 필요",
  modify: "원본 수정",
  "bulk-modify": "대량 수정",
  delete: "삭제/덮어쓰기"
};

export function resolveFlowRunNodeIds(
  nodes: FlowNode[],
  connections: FlowConnection[],
  mode: FlowRunMode,
  scope: FlowRunScope,
  selectedNodeId?: string
) {
  const orderedIds = orderFlowNodeIdsByConnections(nodes, connections);
  const selectedExists = selectedNodeId ? orderedIds.includes(selectedNodeId) : false;
  const scopedIds =
    scope === "selected" && selectedNodeId && selectedExists
      ? [selectedNodeId]
      : scope === "from-selected" && selectedNodeId && selectedExists
        ? orderedIds.filter((nodeId) =>
            collectConnectedNodeIds(selectedNodeId, connections, "outgoing").has(nodeId)
          )
        : scope === "to-selected" && selectedNodeId && selectedExists
          ? orderedIds.filter((nodeId) =>
              collectConnectedNodeIds(selectedNodeId, connections, "incoming").has(nodeId)
            )
          : orderedIds;

  return mode === "step" ? scopedIds.slice(0, 1) : scopedIds;
}

export function orderFlowNodeIdsByConnections(nodes: FlowNode[], connections: FlowConnection[]) {
  const nodeIds = nodes.map((node) => node.nodeId);
  const knownNodeIds = new Set(nodeIds);
  const originalIndex = new Map(nodeIds.map((nodeId, index) => [nodeId, index]));
  const outgoing = new Map<string, string[]>();
  const indegree = new Map(nodeIds.map((nodeId) => [nodeId, 0]));

  connections.forEach((connection) => {
    if (!knownNodeIds.has(connection.fromNodeId) || !knownNodeIds.has(connection.toNodeId)) {
      return;
    }

    const targets = outgoing.get(connection.fromNodeId) ?? [];
    if (!targets.includes(connection.toNodeId)) {
      targets.push(connection.toNodeId);
      outgoing.set(connection.fromNodeId, targets);
      indegree.set(connection.toNodeId, (indegree.get(connection.toNodeId) ?? 0) + 1);
    }
  });

  const orderedIds: string[] = [];
  const readyIds = nodeIds
    .filter((nodeId) => (indegree.get(nodeId) ?? 0) === 0)
    .sort((left, right) => (originalIndex.get(left) ?? 0) - (originalIndex.get(right) ?? 0));

  while (readyIds.length > 0) {
    const nodeId = readyIds.shift()!;
    orderedIds.push(nodeId);

    (outgoing.get(nodeId) ?? []).forEach((targetId) => {
      const nextIndegree = (indegree.get(targetId) ?? 0) - 1;
      indegree.set(targetId, nextIndegree);
      if (nextIndegree === 0) {
        readyIds.push(targetId);
        readyIds.sort((left, right) => (originalIndex.get(left) ?? 0) - (originalIndex.get(right) ?? 0));
      }
    });
  }

  const orderedSet = new Set(orderedIds);
  const cyclicOrDisconnectedIds = nodeIds.filter((nodeId) => !orderedSet.has(nodeId));
  return [...orderedIds, ...cyclicOrDisconnectedIds];
}

function collectConnectedNodeIds(
  startNodeId: string,
  connections: FlowConnection[],
  direction: "incoming" | "outgoing"
) {
  const result = new Set<string>([startNodeId]);
  const queue = [startNodeId];

  while (queue.length > 0) {
    const currentNodeId = queue.shift()!;
    const nextNodeIds = connections
      .filter((connection) =>
        direction === "incoming"
          ? connection.toNodeId === currentNodeId
          : connection.fromNodeId === currentNodeId
      )
      .map((connection) =>
        direction === "incoming" ? connection.fromNodeId : connection.toNodeId
      );

    nextNodeIds.forEach((nodeId) => {
      if (!result.has(nodeId)) {
        result.add(nodeId);
        queue.push(nodeId);
      }
    });
  }

  return result;
}

function previewForNode(node: FlowNode): FlowNodePreview {
  const resultType = node.settingsSchema?.resultSchema.type ?? node.outputs[0]?.type ?? "text";
  const outputLabels = node.outputs.map((port) => port.label).join(", ") || "결과";
  const baseTitle = `${node.name} 결과 미리보기`;

  if (node.id === "cad-read" || resultType.includes("cad")) {
    return {
      title: baseTitle,
      summary: "CAD에서 읽은 객체를 표 형태로 넘길 준비를 합니다.",
      metrics: [
        { label: "결과 형태", value: "객체 목록" },
        { label: "출력", value: outputLabels }
      ],
      rows: [
        { "항목": "레이어", "값": "A-WALL, A-DOOR" },
        { "항목": "객체", "값": "Line, Polyline, Block" }
      ]
    };
  }

  if (node.id === "excel-export" || resultType === "file" || resultType === "excel_range") {
    return {
      title: baseTitle,
      summary: "앞 노드 결과를 Excel 표 또는 파일로 정리합니다.",
      metrics: [
        { label: "결과 형태", value: "Excel 파일" },
        { label: "출력", value: outputLabels }
      ],
      rows: [
        { "항목": "파일명", "값": "설정값 기준 생성" },
        { "항목": "처리", "값": "표 형식 정리" }
      ]
    };
  }

  if (node.id === "revit-place" || resultType.includes("revit")) {
    return {
      title: baseTitle,
      summary: "Revit 요소 생성/수정 명령으로 넘길 데이터를 준비합니다.",
      metrics: [
        { label: "결과 형태", value: "Revit 요소 ID" },
        { label: "출력", value: outputLabels }
      ],
      rows: [
        { "항목": "패밀리 타입", "값": "설정값 사용" },
        { "항목": "레벨", "값": "설정값 사용" }
      ]
    };
  }

  return {
    title: baseTitle,
    summary: `${resultType} 결과를 다음 노드로 전달합니다.`,
    metrics: [
      { label: "결과 형태", value: resultType },
      { label: "출력", value: outputLabels }
    ],
    rows: [{ "항목": "상태", "값": "실행 후 실제 결과 표시 예정" }]
  };
}

function impactForNode(node: FlowNode): FlowImpactSummary {
  const schema = node.settingsSchema;
  const risk = schema?.risk ?? "read";
  const plan = schema ? buildToolExecutionPlan(schema, node.settingsValues) : null;
  const items = [
    riskTitle[risk],
    ...(node.id === "excel-export" ? ["파일 생성 예정"] : []),
    ...(node.id === "revit-place" ? ["Revit 요소 생성/수정 예정"] : []),
    ...(schema?.requiredServers ?? []).map((server) => `${server.toUpperCase()} MCP 연결 필요`),
    ...(plan?.commands ?? []).map((command) => `${command.server}.${command.command} 예정`),
    node.outputs.length > 0 ? `출력: ${node.outputs.map((port) => port.label).join(", ")}` : "출력 없음"
  ];

  return {
    title: riskTitle[risk],
    tone: riskTone[risk],
    items: items.length > 0 ? items : ["영향 범위 정보 없음"]
  };
}

export function buildFlowRunRecords(
  nodes: FlowNode[],
  connections: FlowConnection[],
  nodeIds: string[]
): FlowRunRecord[] {
  const connectionCountByNode = new Map<string, number>();
  connections.forEach((connection) => {
    connectionCountByNode.set(
      connection.fromNodeId,
      (connectionCountByNode.get(connection.fromNodeId) ?? 0) + 1
    );
  });

  return nodeIds
    .map((nodeId, index) => {
      const node = nodes.find((item) => item.nodeId === nodeId);
      if (!node) {
        return null;
      }

      const preview = previewForNode(node);
      const impact = impactForNode(node);
      const outgoingCount = connectionCountByNode.get(node.nodeId) ?? 0;
      return {
        id: `run-${Date.now()}-${index}-${node.nodeId}`,
        nodeId: node.nodeId,
        nodeName: node.name,
        status: "queued" as FlowRunRecordStatus,
        message:
          outgoingCount > 0
            ? `다음 ${outgoingCount}개 연결로 결과 전달 예정`
            : "마지막 노드 또는 결과 확인 노드입니다.",
        impact,
        preview
      };
    })
    .filter((record): record is FlowRunRecord => Boolean(record));
}

function strongestRisk(nodes: FlowNode[]): ToolRuntimeSchema["risk"] {
  return nodes.reduce<ToolRuntimeSchema["risk"]>((current, node) => {
    const risk = node.settingsSchema?.risk ?? "read";
    return riskRank[risk] > riskRank[current] ? risk : current;
  }, "read");
}

function nodeSettingPrefix(node: FlowNode) {
  return node.nodeId.replace(/[^A-Za-z0-9_-]/g, "_");
}

function groupSettingId(node: FlowNode, settingId: string) {
  return `${nodeSettingPrefix(node)}__${settingId}`;
}

function remapSettingReference(value: string, node: FlowNode) {
  const match = value.match(/^settings\.([A-Za-z0-9_-]+)$/);
  return match ? `settings.${groupSettingId(node, match[1])}` : value;
}

function remapOptionalSettingReference(value: string | undefined, node: FlowNode) {
  return value ? remapSettingReference(value, node) : undefined;
}

function cloneGroupSetting(node: FlowNode, field: ToolSettingField): ToolSettingField {
  const section = `node-${nodeSettingPrefix(node)}`;
  return {
    ...field,
    id: groupSettingId(node, field.id),
    label: `${node.name} / ${field.label}`,
    section,
    visibleWhen: field.visibleWhen
      ? {
          ...field.visibleWhen,
          field: groupSettingId(node, field.visibleWhen.field)
        }
      : undefined
  };
}

function cloneGroupCommand(node: FlowNode, command: ToolMcpCommand): ToolMcpCommand {
  return {
    ...command,
    params: command.params
      ? Object.fromEntries(
          Object.entries(command.params).map(([key, value]) => [key, remapSettingReference(value, node)])
        )
      : undefined,
    condition: remapOptionalSettingReference(command.condition, node)
  };
}

export function buildFlowGroupToolSchema(
  group: FlowGroup,
  nodes: FlowNode[],
  connections: FlowConnection[]
): ToolRuntimeSchema {
  const groupNodeIds = new Set(group.nodeIds);
  const groupNodesById = new Map(nodes.map((node) => [node.nodeId, node]));
  const groupNodes = orderFlowNodeIdsByConnections(
    nodes.filter((node) => groupNodeIds.has(node.nodeId)),
    connections.filter(
      (connection) =>
        groupNodeIds.has(connection.fromNodeId) && groupNodeIds.has(connection.toNodeId)
    )
  )
    .map((nodeId) => groupNodesById.get(nodeId))
    .filter((node): node is FlowNode => Boolean(node));
  const requiredServers = Array.from(
    new Set(groupNodes.flatMap((node) => node.settingsSchema?.requiredServers ?? []))
  );
  const mcpCommands = groupNodes.flatMap((node) =>
    (node.settingsSchema?.mcpCommands ?? []).map((command) => cloneGroupCommand(node, command))
  );
  const externalInputPortIds = new Set(
    connections
      .filter((connection) => groupNodeIds.has(connection.toNodeId) && !groupNodeIds.has(connection.fromNodeId))
      .map((connection) => `${connection.toNodeId}:${connection.toPortId}`)
  );
  const externalOutputPortIds = new Set(
    connections
      .filter((connection) => groupNodeIds.has(connection.fromNodeId) && !groupNodeIds.has(connection.toNodeId))
      .map((connection) => `${connection.fromNodeId}:${connection.fromPortId}`)
  );
  const firstNode = groupNodes[0];
  const lastNode = groupNodes.at(-1);
  const inputs = groupNodes
    .flatMap((node) =>
      node.inputs
        .filter((port) => externalInputPortIds.has(`${node.nodeId}:${port.id}`))
        .map((port) => ({ id: port.id, label: port.label, type: port.type }))
    );
  const outputs = groupNodes
    .flatMap((node) =>
      node.outputs
        .filter((port) => externalOutputPortIds.has(`${node.nodeId}:${port.id}`))
        .map((port) => ({ id: port.id, label: port.label, type: port.type }))
    );
  const fallbackInputs =
    inputs.length > 0
      ? inputs
      : (firstNode?.inputs ?? []).map((port) => ({ id: port.id, label: port.label, type: port.type }));
  const fallbackOutputs =
    outputs.length > 0
      ? outputs
      : (lastNode?.outputs ?? []).map((port) => ({ id: port.id, label: port.label, type: port.type }));
  const resultType = fallbackOutputs[0]?.type ?? "text";
  const settings = groupNodes.flatMap((node) =>
    (node.settingsSchema?.settings ?? []).map((field) => cloneGroupSetting(node, field))
  );
  const sections = groupNodes
    .filter((node) => (node.settingsSchema?.settings ?? []).length > 0)
    .map((node) => ({
      id: `node-${nodeSettingPrefix(node)}`,
      label: node.name,
      defaultOpen: true
    }));

  return {
    ...defaultToolRuntimeSchema,
    risk: strongestRisk(groupNodes),
    executionMode: "custom-flow",
    requiredServers,
    mcpCommands,
    resultSchema: {
      type: resultType,
      fields: fallbackOutputs.map((port) => ({
        id: port.id,
        label: port.label,
        type: flowPortTypeFromToolType(port.type)
      }))
    },
    settingsLayout: {
      mode: "sections",
      sections: sections.length > 0
        ? sections
        : [{ id: "subflow", label: "서브플로우", defaultOpen: true }]
    },
    settings,
    inputs: fallbackInputs.map((port) => ({
      id: port.id,
      label: port.label,
      type: flowPortTypeFromToolType(port.type)
    })),
    outputs: fallbackOutputs.map((port) => ({
      id: port.id,
      label: port.label,
      type: flowPortTypeFromToolType(port.type)
    })),
    preflightChecks: requiredServers.map((server) => ({
      id: `${server}_connected`,
      label: `${server.toUpperCase()} MCP 연결`,
      severity: "error",
      message: `${server.toUpperCase()} MCP 서버가 연결되어 있어야 합니다.`,
      blocksExecution: true
    })),
    testCases: [
      {
        name: "서브플로우 기본 실행",
        given: "같은 입력 노드와 같은 설정값",
        expect: "그룹 내부 노드를 같은 순서로 실행하고 같은 결과 포트를 반환"
      }
    ]
  };
}
