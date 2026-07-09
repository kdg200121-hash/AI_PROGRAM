import {
  settingDefaultValue,
  type ToolMcpCommand,
  type ToolRuntimeSchema,
  type ToolSettingValue
} from "./toolSettingsSchema";

export interface ToolExecutionRequestCommand {
  server: string;
  command: string;
  status: ToolMcpCommand["status"];
  runtimeAction: string;
  params: Record<string, unknown>;
  condition?: string;
}

export interface ToolExecutionRequest {
  kind: "ai-mcp-tool-execution";
  toolName: string;
  menuName: string;
  runtimeAction: string;
  requiredServers: string[];
  values: Record<string, ToolSettingValue>;
  commands: ToolExecutionRequestCommand[];
  aiInstruction: string;
  createdAt: string;
}

export interface TitleBlockCandidate {
  id: string;
  label: string;
  detail: string;
}

export interface ToolExecutionResult {
  status: "preview" | "completed" | "needs-ai" | "error";
  message: string;
  raw?: unknown;
  titleBlockCandidates?: TitleBlockCandidate[];
}

export interface BuildToolExecutionRequestInput {
  toolName: string;
  menuName: string;
  runtimeAction: string;
  schema: ToolRuntimeSchema;
  values?: Record<string, ToolSettingValue>;
}

function fieldValues(schema: ToolRuntimeSchema, values?: Record<string, ToolSettingValue>) {
  return schema.settings.reduce<Record<string, ToolSettingValue>>((record, field) => {
    record[field.id] = values?.[field.id] ?? settingDefaultValue(field);
    return record;
  }, {});
}

function resolveParamValue(raw: string, values: Record<string, ToolSettingValue>) {
  const settingMatch = raw.match(/^settings\.([A-Za-z0-9_-]+)$/);
  if (!settingMatch) {
    if (raw === "true") {
      return true;
    }
    if (raw === "false") {
      return false;
    }
    return raw;
  }
  return values[settingMatch[1]] ?? "";
}

function looksLikeTitleBlockTool(schema: ToolRuntimeSchema) {
  const text = [
    ...schema.settings.flatMap((field) => [field.id, field.label, field.description]),
    ...schema.mcpCommands.flatMap((command) => [command.server, command.command]),
    schema.resultSchema.type
  ]
    .join(" ")
    .toLowerCase();

  return (
    text.includes("도곽") ||
    text.includes("title_block") ||
    text.includes("titleblock") ||
    (text.includes("title") && text.includes("block"))
  );
}

function commandParams(
  command: ToolMcpCommand,
  values: Record<string, ToolSettingValue>
) {
  return Object.entries(command.params ?? {}).reduce<Record<string, unknown>>((record, [key, value]) => {
    record[key] = resolveParamValue(value, values);
    return record;
  }, {});
}

export function buildToolExecutionRequest({
  toolName,
  menuName,
  runtimeAction,
  schema,
  values
}: BuildToolExecutionRequestInput): ToolExecutionRequest {
  const resolvedValues = fieldValues(schema, values);
  const titleBlockTool = looksLikeTitleBlockTool(schema);
  const commands = schema.mcpCommands
    .filter((command) => !command.runtimeAction || command.runtimeAction === runtimeAction)
    .map<ToolExecutionRequestCommand>((command) => ({
      server: command.server,
      command: command.command,
      status: command.status,
      runtimeAction,
      params: commandParams(command, resolvedValues),
      condition: command.condition
    }));

  const aiInstruction = [
    `${menuName} 메뉴의 "${toolName}" 툴을 ${runtimeAction === "preview" ? "미리보기" : "실행"}합니다.`,
    "사용자가 입력한 설정값을 기준으로 MD 설명과 MCP 명령 계획을 해석합니다.",
    titleBlockTool
      ? "도곽 후보는 CAD 도면 안의 실제 블록명, 배치명, 핸들, 개수를 분석해서 반환해야 하며 임의의 후보를 만들지 않습니다."
      : "필요한 MCP 서버와 명령을 전달하고 결과와 오류를 구조화해서 반환합니다.",
    "AI가 필요한 경우 설정값을 검토한 뒤 필요한 MCP 명령 순서와 파라미터를 확정합니다."
  ].join("\n");

  return {
    kind: "ai-mcp-tool-execution",
    toolName,
    menuName,
    runtimeAction,
    requiredServers: [...schema.requiredServers],
    values: resolvedValues,
    commands,
    aiInstruction,
    createdAt: new Date().toISOString()
  };
}

function firstString(...values: unknown[]) {
  return values.find((value): value is string => typeof value === "string" && value.trim().length > 0);
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    const numberValue = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(numberValue)) {
      return numberValue;
    }
  }
  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function firstErrorText(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    const record = asRecord(value);
    if (record) {
      const nested = firstErrorText(
        record.message,
        record.error,
        record.reason,
        record.detail,
        record.description
      );
      if (nested) {
        return nested;
      }
    }
  }
  return "";
}

function issueHasErrorSeverity(issue: unknown) {
  const record = asRecord(issue);
  if (!record) {
    return false;
  }
  return [record.severity, record.level, record.type, record.status].some(
    (value) => typeof value === "string" && ["error", "failed", "failure"].includes(value.toLowerCase())
  );
}

function payloadErrorMessage(payload: unknown): string {
  const record = asRecord(payload);
  if (!record) {
    return "";
  }
  if (record.ok === false || record.success === false) {
    return firstErrorText(record.message, record.error, record.reason, record.detail) || "툴 실행 결과가 실패로 반환되었습니다.";
  }
  for (const key of ["errors", "errorMessages", "failures"]) {
    const value = record[key];
    if (Array.isArray(value) && value.length > 0) {
      return firstErrorText(value[0]) || "툴 실행 중 오류가 반환되었습니다.";
    }
  }
  for (const key of ["issues", "diagnostics"]) {
    const value = record[key];
    if (Array.isArray(value)) {
      const errorIssue = value.find(issueHasErrorSeverity);
      if (errorIssue) {
        return firstErrorText(errorIssue) || "툴 실행 결과에 오류 항목이 포함되어 있습니다.";
      }
    }
  }
  return "";
}

export function toolExecutionFailureMessage(result: ToolExecutionResult): string {
  if (result.status === "error") {
    return result.message || "툴 실행 중 오류가 발생했습니다.";
  }

  const directFailure = payloadErrorMessage(result);
  if (directFailure) {
    return directFailure;
  }

  const rawFailure = payloadErrorMessage(result.raw);
  if (rawFailure) {
    return rawFailure;
  }

  const rawRecord = asRecord(result.raw);
  if (rawRecord) {
    for (const key of ["mcp", "result", "data", "response"]) {
      const nestedFailure = payloadErrorMessage(rawRecord[key]);
      if (nestedFailure) {
        return nestedFailure;
      }
    }
  }

  return "";
}

function executionSearchText(result: ToolExecutionResult) {
  return [toolExecutionFailureMessage(result), result.message, JSON.stringify(result.raw ?? {})]
    .filter(Boolean)
    .join(" ");
}

export function toolExecutionRecoveryMessage(result: ToolExecutionResult): string {
  const message = executionSearchText(result);
  if (/revitBusyOrBlocked|Press ESC in Revit|Timed out while reading Revit|Revit.*timed out/i.test(message)) {
    return "Revit이 현재 명령/선택 상태라 응답하지 않습니다. Revit에서 ESC를 눌러 현재 명령을 취소한 뒤 다시 실행하세요.";
  }
  if (/textSelectionRequired|Selected objects do not include AutoCAD TEXT or MTEXT/i.test(message)) {
    return "선택한 객체 안에 TEXT/MTEXT 문자가 없습니다. AutoCAD에서 변경할 문자 객체만 다시 선택한 뒤 실행하세요.";
  }
  if (/selectionRequired|Select AutoCAD TEXT or MTEXT objects first|Select the CAD objects/i.test(message)) {
    return "AutoCAD에서 문자 객체를 먼저 선택한 뒤 다시 실행하세요. 이 명령은 선택된 TEXT/MTEXT만 처리합니다.";
  }
  if (/confirmApplyRequired|confirmApply=true|Preview is ready/i.test(message)) {
    return "미리보기는 완료됐지만 실제 도면 수정은 막혀 있습니다. 실제로 바꾸려면 노드 설정에서 적용 확인을 켜고 다시 실행하세요.";
  }
  if (/emptySource|no rows to write|has no rows/i.test(message)) {
    return "앞 노드 결과가 비어 있어 다음 노드로 넘길 데이터가 없습니다. 연결선과 이전 노드 실행 결과를 확인하세요.";
  }
  if (/ECONNREFUSED|connection refused|fetch failed|Failed to fetch|connect ECONN/i.test(message)) {
    return "MCP 서버에 연결하지 못했습니다. 해당 프로그램이 켜져 있는지, MCP 서버가 실행 중인지, 포트가 맞는지 확인하세요.";
  }
  if (/timeout|timed out|operation has timed out/i.test(message)) {
    return "응답 시간이 초과되었습니다. 큰 파일을 처리 중이거나 외부 프로그램이 다른 명령 상태일 수 있습니다. 잠시 기다린 뒤 다시 실행하세요.";
  }
  return toolExecutionFailureMessage(result);
}

function candidateArrays(payload: unknown): unknown[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }
  const record = payload as Record<string, unknown>;
  return [
    record.titleBlockCandidates,
    record.title_block_candidates,
    record.titleBlocks,
    record.title_blocks,
    record.candidates,
    record.result && typeof record.result === "object"
      ? (record.result as Record<string, unknown>).titleBlockCandidates
      : undefined,
    record.result && typeof record.result === "object"
      ? (record.result as Record<string, unknown>).titleBlocks
      : undefined
  ].flatMap((value) => (Array.isArray(value) ? value : []));
}

export function extractTitleBlockCandidates(payload: unknown): TitleBlockCandidate[] {
  return candidateArrays(payload).flatMap((candidate, index) => {
    if (!candidate || typeof candidate !== "object") {
      return [];
    }
    const record = candidate as Record<string, unknown>;
    const label = firstString(
      record.blockName,
      record.block_name,
      record.titleBlockName,
      record.title_block_name,
      record.name,
      record.label
    );
    if (!label) {
      return [];
    }

    const id = firstString(record.id, record.handle, record.sampleHandle, record.sample_handle) ?? label;
    const layoutName = firstString(record.layoutName, record.layout_name, record.layout);
    const count = firstNumber(record.count, record.occurrences, record.instances);
    const handle = firstString(record.sampleHandle, record.sample_handle, record.handle);
    const detailParts = [
      layoutName,
      count === undefined ? undefined : `${count}개`,
      handle ? `핸들 ${handle}` : undefined
    ].filter((item): item is string => Boolean(item));

    return [
      {
        id: index === 0 ? id : id,
        label,
        detail: detailParts.length > 0 ? detailParts.join(" · ") : "CAD MCP 분석 후보"
      }
    ];
  });
}
