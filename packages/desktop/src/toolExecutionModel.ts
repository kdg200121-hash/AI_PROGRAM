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
  const commands = schema.mcpCommands.map<ToolExecutionRequestCommand>((command) => ({
    server: command.server,
    command: command.command,
    status: command.status,
    runtimeAction,
    params: commandParams(command, resolvedValues),
    condition: command.condition
  }));

  const aiInstruction = [
    `${menuName} 메뉴의 "${toolName}" 툴을 ${runtimeAction === "preview" ? "미리보기" : "실행"}합니다.`,
    "사용자가 입력한 설정값을 기준으로 MD 툴 설명과 MCP 명령 계획을 해석합니다.",
    titleBlockTool
      ? "도곽 후보는 CAD 도면 안의 실제 블록명, 배치명, 핸들, 개수를 분석해서 반환해야 하며 앱이 임의 후보를 만들지 않습니다."
      : "필요한 MCP 서버에 명령을 전달하고 결과와 오류를 구조화해서 반환합니다.",
    "AI는 설정값을 검토한 뒤 필요한 MCP 명령 순서와 파라미터를 확정합니다."
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
  const value = values.find((item) => Number.isFinite(typeof item === "number" ? item : Number(item)));
  return value === undefined ? undefined : Number(value);
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
