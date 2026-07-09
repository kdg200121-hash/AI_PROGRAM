import type { FlowConnection, FlowNode } from "./customFlowModel";
import { buildToolExecutionRequest, type ToolExecutionResult } from "./toolExecutionModel";
import type { ToolSettingValue } from "./toolSettingsSchema";

export interface BuildFlowNodeExecutionRequestInput {
  node: FlowNode;
  menuName: string;
  runtimeAction: string;
  inputResults?: Record<string, unknown>;
}

function firstInputResult(inputResults: Record<string, unknown>) {
  return Object.values(inputResults)[0];
}

function replacePreviousResultReference(value: unknown, inputResults: Record<string, unknown>) {
  if (value === "previous.result") {
    return firstInputResult(inputResults) ?? "";
  }

  if (typeof value === "string") {
    const portMatch = value.match(/^previous\.([A-Za-z0-9_-]+)$/);
    if (portMatch) {
      return inputResults[portMatch[1]] ?? "";
    }
  }

  return value;
}

function handlesFromRows(value: unknown): string[] {
  const record = asRecord(value);
  const nestedResult = asRecord(record?.result);
  const rows: unknown[] = Array.isArray(value)
    ? value
    : Array.isArray(record?.rows)
      ? record.rows
      : Array.isArray(nestedResult?.rows)
        ? nestedResult.rows
        : [];

  return rows
    .map((row) => asRecord(row)?.handle)
    .filter((handle): handle is string => typeof handle === "string" && handle.length > 0);
}

function replaceCommandParamReference(
  key: string,
  value: unknown,
  inputResults: Record<string, unknown>
) {
  const resolved = replacePreviousResultReference(value, inputResults);
  if (key === "handles") {
    const handles = handlesFromRows(resolved);
    return handles.length > 0 ? handles : resolved;
  }
  return resolved;
}

export function buildFlowNodeExecutionRequest({
  node,
  menuName,
  runtimeAction,
  inputResults = {}
}: BuildFlowNodeExecutionRequestInput) {
  if (!node.settingsSchema) {
    return null;
  }

  const request = buildToolExecutionRequest({
    toolName: node.name,
    menuName,
    runtimeAction,
    schema: node.settingsSchema,
    values: node.settingsValues as Record<string, ToolSettingValue> | undefined
  });

  return {
    ...request,
    commands: request.commands.map((command) => ({
      ...command,
      params: Object.fromEntries(
        Object.entries(command.params).map(([key, value]) => [
          key,
          replaceCommandParamReference(key, value, inputResults)
        ])
      )
    }))
  };
}

export function flowInputResultsForNode(
  node: FlowNode,
  connections: FlowConnection[],
  resultsByNodeId: Map<string, unknown>
) {
  return connections
    .filter((connection) => connection.toNodeId === node.nodeId)
    .reduce<Record<string, unknown>>((record, connection) => {
      if (resultsByNodeId.has(connection.fromNodeId)) {
        record[connection.toPortId] = resultsByNodeId.get(connection.fromNodeId);
      }
      return record;
    }, {});
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function flowResultPayload(result: ToolExecutionResult): unknown {
  const raw = asRecord(result.raw);
  if (!raw) {
    return { message: result.message };
  }

  if ("mcp" in raw) {
    return raw.mcp;
  }
  if ("result" in raw) {
    return raw.result;
  }
  if ("data" in raw) {
    return raw.data;
  }
  return result.raw;
}

export function syntheticFlowNodeResult(
  node: FlowNode,
  inputResults: Record<string, unknown> = {}
): unknown {
  if (node.id === "basic-result-preview") {
    return firstInputResult(inputResults) ?? { message: "표시할 이전 노드 결과가 없습니다." };
  }
  if (node.id === "basic-path-select") {
    return node.pathSelection ?? { path: "", name: "" };
  }
  if (node.id === "basic-active-file") {
    return node.activeFileSelections ?? [];
  }
  if (node.id === "basic-custom-prompt") {
    return { prompt: node.promptText ?? "" };
  }
  return { message: `${node.name} 보조 노드가 처리되었습니다.` };
}

export function shouldContinueAfterFlowNodeFailure(node: FlowNode) {
  return node.settingsSchema?.failurePolicy.partialSuccess === "keep-success";
}
