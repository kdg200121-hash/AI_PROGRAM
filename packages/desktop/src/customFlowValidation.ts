import type { FlowConnection, FlowNode } from "./customFlowModel";
import { isFlowTypeCompatible } from "./customFlowModel";
import { validateToolSettingsValues } from "./toolRuntimeValidation";

export type FlowValidationSeverity = "error" | "warning";

export interface FlowValidationIssue {
  id: string;
  severity: FlowValidationSeverity;
  title: string;
  message: string;
  nodeId?: string;
  connectionId?: string;
}

export function validateFlowGraph(
  nodes: FlowNode[],
  connections: FlowConnection[]
): FlowValidationIssue[] {
  const issues: FlowValidationIssue[] = [];
  const nodeMap = new Map(nodes.map((node) => [node.nodeId, node]));
  const connectedInputs = new Set<string>();

  if (nodes.length === 0) {
    issues.push({
      id: "empty-flow",
      severity: "error",
      title: "노드 없음",
      message: "실행할 노드가 없습니다."
    });
  }

  for (const connection of connections) {
    const fromNode = nodeMap.get(connection.fromNodeId);
    const toNode = nodeMap.get(connection.toNodeId);
    if (!fromNode || !toNode) {
      issues.push({
        id: `missing-node-${connection.id}`,
        severity: "error",
        title: "없는 노드 연결",
        message: "삭제된 노드를 가리키는 연결선이 남아 있습니다.",
        connectionId: connection.id
      });
      continue;
    }

    const outputPort = fromNode.outputs.find((port) => port.id === connection.fromPortId);
    const inputPort = toNode.inputs.find((port) => port.id === connection.toPortId);
    if (!outputPort || !inputPort) {
      issues.push({
        id: `missing-port-${connection.id}`,
        severity: "error",
        title: "없는 포트 연결",
        message: "삭제된 입력/출력 포트를 가리키는 연결선이 남아 있습니다.",
        connectionId: connection.id
      });
      continue;
    }

    connectedInputs.add(`${toNode.nodeId}:${inputPort.id}`);
    if (!isFlowTypeCompatible(outputPort, inputPort)) {
      issues.push({
        id: `type-mismatch-${connection.id}`,
        severity: "warning",
        title: "포트 타입 불일치",
        message: `${fromNode.name}의 ${outputPort.label} 출력과 ${toNode.name}의 ${inputPort.label} 입력 타입이 다릅니다.`,
        connectionId: connection.id
      });
    }
  }

  for (const node of nodes) {
    if (node.settingsSchema) {
      validateToolSettingsValues(node.settingsSchema, node.settingsValues).forEach((issue) => {
        issues.push({
          id: `node-setting-${node.nodeId}-${issue.id}`,
          severity: issue.severity === "error" ? "error" : "warning",
          title: issue.title,
          message: `${node.name}: ${issue.message}`,
          nodeId: node.nodeId
        });
      });
    }

    for (const input of node.inputs) {
      if (input.type === "cad") {
        continue;
      }

      if (!connectedInputs.has(`${node.nodeId}:${input.id}`)) {
        issues.push({
          id: `missing-input-${node.nodeId}-${input.id}`,
          severity: "warning",
          title: "입력 미연결",
          message: `${node.name}의 ${input.label} 입력이 연결되어 있지 않습니다.`,
          nodeId: node.nodeId
        });
      }
    }
  }

  if (nodes.length > 1 && connections.length === 0) {
    issues.push({
      id: "no-connections",
      severity: "warning",
      title: "연결 없음",
      message: "노드가 여러 개 있지만 연결선이 없습니다."
    });
  }

  return issues;
}
