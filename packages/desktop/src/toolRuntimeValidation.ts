import {
  settingDefaultValue,
  type ToolMcpCommand,
  type ToolRuntimeSchema,
  type ToolSettingField,
  type ToolSettingValue
} from "./toolSettingsSchema";

export type ToolRuntimeIssueSeverity = "error" | "warning" | "info";

export interface ToolRuntimeIssue {
  id: string;
  severity: ToolRuntimeIssueSeverity;
  title: string;
  message: string;
  fieldId?: string;
}

export interface ToolExecutionCommandPlan {
  index: number;
  server: string;
  command: string;
  status: ToolMcpCommand["status"];
  params: Record<string, string>;
}

export interface ToolExecutionPlan {
  commands: ToolExecutionCommandPlan[];
  summary: string[];
  sampleResult: string;
  issues: ToolRuntimeIssue[];
}

const riskyLevels = new Set<ToolRuntimeSchema["risk"]>([
  "create",
  "modify",
  "bulk-modify",
  "delete",
  "caution"
]);

export function isEmptyToolSettingValue(value: ToolSettingValue | undefined) {
  if (value === undefined || value === null) {
    return true;
  }
  if (typeof value === "string") {
    return value.trim().length === 0;
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  return false;
}

function fieldValue(field: ToolSettingField, values?: Record<string, ToolSettingValue>) {
  return values?.[field.id] ?? settingDefaultValue(field);
}

function stringifyValue(value: ToolSettingValue | undefined) {
  if (value === undefined || value === null) {
    return "";
  }
  if (Array.isArray(value)) {
    return value.every((item) => typeof item === "string")
      ? value.join(", ")
      : JSON.stringify(value);
  }
  return String(value);
}

function resolveParamValue(raw: string, values?: Record<string, ToolSettingValue>) {
  const settingMatch = raw.match(/^settings\.([A-Za-z0-9_-]+)$/);
  if (!settingMatch) {
    return raw;
  }
  return stringifyValue(values?.[settingMatch[1]]);
}

export function validateToolRuntimeSchema(schema: ToolRuntimeSchema): ToolRuntimeIssue[] {
  const issues: ToolRuntimeIssue[] = [];
  const isExecutable = ["mcp", "custom-flow", "hybrid"].includes(schema.executionMode);

  if (isExecutable && schema.requiredServers.length === 0) {
    issues.push({
      id: "missing-required-servers",
      severity: "warning",
      title: "필요 MCP 서버 없음",
      message: "실행형 툴인데 필요한 MCP 서버가 지정되어 있지 않습니다."
    });
  }

  if (riskyLevels.has(schema.risk) && schema.preflightChecks.length === 0) {
    issues.push({
      id: "missing-preflight-checks",
      severity: "warning",
      title: "실행 전 점검 없음",
      message: "원본을 만들거나 수정할 수 있는 툴은 실행 전 점검 조건이 필요합니다."
    });
  }

  if (riskyLevels.has(schema.risk) && schema.failurePolicy.rollback === "none") {
    issues.push({
      id: "weak-failure-policy",
      severity: "warning",
      title: "실패 처리 약함",
      message: "수정/삭제/대량 작업 툴은 실패 시 되돌리기나 백업 정책을 정하는 것이 안전합니다."
    });
  }

  schema.mcpCommands.forEach((command, index) => {
    if (!command.server || !command.command) {
      issues.push({
        id: `invalid-command-${index + 1}`,
        severity: "error",
        title: "MCP 명령 정보 부족",
        message: `${index + 1}번째 MCP 명령의 서버 또는 명령 이름이 비어 있습니다.`
      });
    }
  });

  return issues;
}

export function validateToolSettingsValues(
  schema: ToolRuntimeSchema,
  values?: Record<string, ToolSettingValue>
): ToolRuntimeIssue[] {
  const issues: ToolRuntimeIssue[] = [];

  schema.settings.forEach((field) => {
    const value = fieldValue(field, values);
    if (field.required && isEmptyToolSettingValue(value)) {
      issues.push({
        id: `missing-setting-${field.id}`,
        severity: "error",
        title: "필수 설정 누락",
        message: `${field.label} 값이 필요합니다.`,
        fieldId: field.id
      });
    }
  });

  return issues;
}

export function buildToolExecutionPlan(
  schema: ToolRuntimeSchema,
  values?: Record<string, ToolSettingValue>
): ToolExecutionPlan {
  const resolvedValues = schema.settings.reduce<Record<string, ToolSettingValue>>(
    (record, field) => {
      record[field.id] = fieldValue(field, values);
      return record;
    },
    {}
  );
  const issues = [
    ...validateToolRuntimeSchema(schema),
    ...validateToolSettingsValues(schema, resolvedValues)
  ];
  const commands: ToolExecutionCommandPlan[] = schema.mcpCommands.map((command, index) => {
    const params = Object.entries(command.params ?? {}).reduce<Record<string, string>>(
      (record, [key, value]) => {
        record[key] = resolveParamValue(value, resolvedValues);
        return record;
      },
      {}
    );

    return {
      index: index + 1,
      server: command.server,
      command: command.command,
      status: command.status,
      params
    };
  });
  const previewFields = schema.settings.filter((field) => field.preview || field.required);
  const summary = [
    ...schema.requiredServers.map((server) => `${server.toUpperCase()} MCP 연결 확인`),
    ...schema.preflightChecks.map((check) => check.label),
    ...previewFields.map((field) => `${field.label}: ${stringifyValue(fieldValue(field, values)) || "미입력"}`)
  ];
  const sampleResult =
    schema.resultSchema.fields.length > 0
      ? `${schema.resultSchema.type} 결과: ${schema.resultSchema.fields
          .map((field) => field.label)
          .join(", ")}`
      : `${schema.resultSchema.type} 결과`;

  return {
    commands,
    summary,
    sampleResult,
    issues
  };
}
