import type { FlowPortType } from "./customFlowModel";

export type ToolSettingValue =
  | string
  | number
  | boolean
  | string[]
  | Record<string, string | number | boolean>[]
  | null;

export interface ToolSettingOption {
  value: string;
  label: string;
}

export interface ToolSettingVisibleWhen {
  field: string;
  equals: string | number | boolean;
}

export interface ToolSettingField {
  id: string;
  label: string;
  type: string;
  required: boolean;
  default: ToolSettingValue;
  description: string;
  placeholder?: string;
  options?: ToolSettingOption[];
  min?: number;
  max?: number;
  step?: number;
  accept?: string;
  itemType?: "text" | "file";
  itemLabel?: string;
  valueKey?: string;
  showItemSummary?: boolean;
  summaryCountKey?: string;
  summaryRangeKey?: string;
  pendingSummaryLabel?: string;
  pendingRangeLabel?: string;
  program?: string;
  visibleWhen?: ToolSettingVisibleWhen;
  section?: string;
  advanced?: boolean;
  preview?: boolean;
  confirmOnChange?: boolean;
  hidden?: boolean;
}

export interface ToolSettingsSection {
  id: string;
  label: string;
  defaultOpen?: boolean;
}

export interface ToolSettingsLayout {
  mode: "simple" | "sections" | "steps" | "table";
  sections: ToolSettingsSection[];
}

export interface ToolPreflightCheck {
  id: string;
  label: string;
  severity: "error" | "warning" | "info";
  message: string;
  fix?: string;
  blocksExecution?: boolean;
}

export interface ToolResultField {
  id: string;
  label: string;
  type: string;
}

export interface ToolResultSchema {
  type: string;
  fields: ToolResultField[];
}

export interface ToolMcpCommand {
  server: string;
  command: string;
  status: "available" | "planned" | "manual";
  params?: Record<string, string>;
  condition?: string;
}

export interface ToolExecutionAction {
  id: string;
  label: string;
  runtimeAction: string;
  description: string;
  primary: boolean;
  requiresPreview: boolean;
  confirm: boolean;
}

export interface ToolTestCase {
  name: string;
  given: string;
  expect: string;
}

export interface ToolFailurePolicy {
  partialSuccess: "report" | "rollback" | "keep-success";
  rollback: "none" | "transaction" | "backup" | "manual";
  log: boolean;
}

export interface ToolRuntimeSchema {
  risk: "read" | "create" | "modify" | "bulk-modify" | "delete" | "safe" | "caution";
  executionMode: "manual" | "mcp" | "custom-flow" | "hybrid";
  requiredServers: string[];
  mcpCommands: ToolMcpCommand[];
  preflightChecks: ToolPreflightCheck[];
  resultSchema: ToolResultSchema;
  failurePolicy: ToolFailurePolicy;
  settingsLayout: ToolSettingsLayout;
  settings: ToolSettingField[];
  actions: ToolExecutionAction[];
  inputs: ToolResultField[];
  outputs: ToolResultField[];
  testCases: ToolTestCase[];
}

export const defaultToolRuntimeSchema: ToolRuntimeSchema = {
  risk: "read",
  executionMode: "manual",
  requiredServers: [],
  mcpCommands: [],
  preflightChecks: [],
  resultSchema: { type: "text", fields: [] },
  failurePolicy: { partialSuccess: "report", rollback: "none", log: true },
  settingsLayout: { mode: "simple", sections: [] },
  settings: [],
  actions: [],
  inputs: [],
  outputs: [],
  testCases: []
};

const scalarTrue = new Set(["true", "yes", "y"]);
const scalarFalse = new Set(["false", "no", "n"]);

export function settingDefaultValue(field: ToolSettingField): ToolSettingValue {
  if (field.default !== null && field.default !== undefined) {
    return field.default;
  }
  if (field.type === "checkbox" || field.type === "dry-run") {
    return false;
  }
  if (field.type === "number" || field.type === "tolerance") {
    return 0;
  }
  if (field.type === "multi-select") {
    return [];
  }
  if (field.type === "repeatable-list" || field.type === "mapping-table") {
    return [];
  }
  return "";
}

export function defaultSettingOptions(field: ToolSettingField): ToolSettingOption[] {
  if (field.options?.length) {
    return field.options;
  }

  const optionMap: Record<string, ToolSettingOption[]> = {
    "scope-picker": [
      { value: "current_selection", label: "현재 선택" },
      { value: "current_view", label: "현재 뷰" },
      { value: "whole_model", label: "전체 모델/도면" },
      { value: "file", label: "파일 선택" },
      { value: "previous_node", label: "이전 노드 결과" }
    ],
    unit: [
      { value: "mm", label: "mm" },
      { value: "m", label: "m" },
      { value: "inch", label: "inch" }
    ],
    "coordinate-system": [
      { value: "internal_origin", label: "내부 원점" },
      { value: "project_base_point", label: "프로젝트 기준점" },
      { value: "survey_point", label: "측량점" },
      { value: "user_coordinate", label: "사용자 좌표" }
    ],
    "overwrite-policy": [
      { value: "skip", label: "기존 값은 건너뛰기" },
      { value: "overwrite", label: "덮어쓰기" },
      { value: "rename", label: "새 이름으로 생성" },
      { value: "ask", label: "실행 때 물어보기" }
    ],
    "conflict-policy": [
      { value: "stop", label: "충돌 시 중단" },
      { value: "skip", label: "충돌 항목 건너뛰기" },
      { value: "overwrite", label: "충돌 항목 덮어쓰기" },
      { value: "report", label: "로그만 남기기" }
    ],
    "backup-policy": [
      { value: "none", label: "백업 없음" },
      { value: "before_run", label: "실행 전 백업" },
      { value: "ask", label: "실행 때 물어보기" }
    ],
    "transaction-policy": [
      { value: "rollback_all", label: "실패 시 전체 취소" },
      { value: "keep_success", label: "성공한 항목 유지" },
      { value: "manual_review", label: "사용자 확인 후 처리" }
    ],
    "version-compatibility": [
      { value: "current", label: "현재 설치 버전" },
      { value: "2026", label: "2026" },
      { value: "2025", label: "2025" },
      { value: "2024", label: "2024" },
      { value: "manual", label: "직접 확인" }
    ]
  };

  return optionMap[field.type] ?? [];
}

export function isSelectLikeSetting(type: string) {
  return [
    "select",
    "layer",
    "level",
    "family-type",
    "parameter",
    "unit",
    "scope-picker",
    "coordinate-system",
    "overwrite-policy",
    "conflict-policy",
    "backup-policy",
    "transaction-policy",
    "version-compatibility"
  ].includes(type);
}

export function flowPortTypeFromToolType(type: string): FlowPortType {
  if (["cad", "cad_object_handles"].includes(type)) {
    return "cad";
  }
  if (["revit", "revit_element_ids"].includes(type)) {
    return "revit";
  }
  if (["excel", "excel_range"].includes(type)) {
    return "excel";
  }
  if (["object", "element-selection", "object-selection"].includes(type)) {
    return "object";
  }
  if (["number", "coordinate", "tolerance", "unit"].includes(type)) {
    return "number";
  }
  if (["table", "mapping-table"].includes(type)) {
    return "table";
  }
  if (["file", "folder"].includes(type)) {
    return "file";
  }
  if (["boolean", "checkbox", "dry-run"].includes(type)) {
    return "boolean";
  }
  return "text";
}

function parseScalar(rawValue: string): ToolSettingValue {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed === "[]" || trimmed === "{}") {
    return trimmed === "[]" ? [] : "";
  }
  const unquoted = trimmed.replace(/^["']|["']$/g, "");
  const lower = unquoted.toLowerCase();
  if (scalarTrue.has(lower)) {
    return true;
  }
  if (scalarFalse.has(lower)) {
    return false;
  }
  const numberValue = Number(unquoted);
  if (unquoted !== "" && Number.isFinite(numberValue) && /^-?\d+(\.\d+)?$/.test(unquoted)) {
    return numberValue;
  }
  return unquoted;
}

function metadataBlock(content: string) {
  return content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)?.[1] ?? "";
}

function blockLines(content: string, key: string) {
  const lines = metadataBlock(content).split(/\r?\n/);
  const startIndex = lines.findIndex((line) => new RegExp(`^${key}:\\s*`).test(line));
  if (startIndex < 0) {
    return [];
  }
  const startLine = lines[startIndex];
  if (/\[\]\s*$/.test(startLine)) {
    return [];
  }

  const output: string[] = [];
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^[A-Za-z0-9_-]+:\s*/.test(line)) {
      break;
    }
    output.push(line);
  }
  return output;
}

function topLevelScalar(content: string, key: string) {
  const match = metadataBlock(content).match(new RegExp(`^${key}:\\s*([^\\r\\n]+)`, "im"));
  return match ? String(parseScalar(match[1])) : "";
}

function parseSimpleStringArray(content: string, key: string) {
  return blockLines(content, key)
    .map((line) => line.match(/^\s*-\s*(.+)$/)?.[1])
    .filter((value): value is string => Boolean(value))
    .map((value) => String(parseScalar(value)));
}

function parseObjectArray(content: string, key: string): Record<string, unknown>[] {
  const lines = blockLines(content, key);
  const items: Record<string, unknown>[] = [];
  let current: Record<string, unknown> | null = null;
  let nestedKey = "";
  let nestedKind: "array" | "object" | "" = "";
  let nestedItems: Record<string, unknown>[] = [];
  let nestedCurrent: Record<string, unknown> | null = null;
  let nestedObject: Record<string, unknown> = {};

  const closeNested = () => {
    if (current && nestedKey) {
      if (nestedKind === "array") {
        if (nestedCurrent) {
          nestedItems.push(nestedCurrent);
        }
        current[nestedKey] = nestedItems;
      } else if (nestedKind === "object") {
        current[nestedKey] = nestedObject;
      }
    }
    nestedKey = "";
    nestedKind = "";
    nestedItems = [];
    nestedCurrent = null;
    nestedObject = {};
  };

  const closeCurrent = () => {
    closeNested();
    if (current) {
      items.push(current);
    }
    current = null;
  };

  lines.forEach((line) => {
    const rootItem = line.match(/^\s{2}-\s+([A-Za-z0-9_-]+):\s*(.*)$/);
    if (rootItem) {
      closeCurrent();
      current = { [rootItem[1]]: parseScalar(rootItem[2]) };
      return;
    }

    if (!current) {
      return;
    }

    const property = line.match(/^\s{4}([A-Za-z0-9_-]+):\s*(.*)$/);
    if (property) {
      closeNested();
      if (property[2].trim() === "") {
        nestedKey = property[1];
        nestedItems = [];
        nestedCurrent = null;
      } else {
        current[property[1]] = parseScalar(property[2]);
      }
      return;
    }

    const nestedItem = line.match(/^\s{6}-\s+([A-Za-z0-9_-]+):\s*(.*)$/);
    if (nestedItem && nestedKey) {
      nestedKind = "array";
      if (nestedCurrent) {
        nestedItems.push(nestedCurrent);
      }
      nestedCurrent = { [nestedItem[1]]: parseScalar(nestedItem[2]) };
      return;
    }

    const nestedObjectProperty = line.match(/^\s{6}([A-Za-z0-9_-]+):\s*(.*)$/);
    if (nestedObjectProperty && nestedKey && nestedKind !== "array") {
      nestedKind = "object";
      nestedObject[nestedObjectProperty[1]] = parseScalar(nestedObjectProperty[2]);
      return;
    }

    const nestedProperty = line.match(/^\s{8}([A-Za-z0-9_-]+):\s*(.*)$/);
    if (nestedProperty && nestedCurrent) {
      nestedCurrent[nestedProperty[1]] = parseScalar(nestedProperty[2]);
    }
  });

  closeCurrent();
  return items;
}

function parseSettingsLayout(content: string): ToolSettingsLayout {
  const lines = blockLines(content, "settingsLayout");
  const modeLine = lines.find((line) => /^\s{2}mode:/.test(line));
  const mode = String(parseScalar(modeLine?.replace(/^\s{2}mode:\s*/, "") ?? "simple"));
  const sections: ToolSettingsSection[] = [];
  let current: Partial<ToolSettingsSection> | null = null;

  for (const line of lines) {
    const item = line.match(/^\s{4}-\s+id:\s*(.*)$/);
    if (item) {
      if (current?.id) {
        sections.push({
          id: current.id,
          label: current.label ?? current.id,
          defaultOpen: current.defaultOpen
        });
      }
      current = { id: String(parseScalar(item[1])) };
      continue;
    }
    const property = line.match(/^\s{6}([A-Za-z0-9_-]+):\s*(.*)$/);
    if (property && current) {
      const value = parseScalar(property[2]);
      if (property[1] === "label") {
        current.label = String(value);
      }
      if (property[1] === "defaultOpen") {
        current.defaultOpen = Boolean(value);
      }
    }
  }

  if (current?.id) {
    sections.push({
      id: current.id,
      label: current.label ?? current.id,
      defaultOpen: current.defaultOpen
    });
  }

  return {
    mode: ["sections", "steps", "table"].includes(mode) ? (mode as ToolSettingsLayout["mode"]) : "simple",
    sections
  };
}

function normalizeOptions(value: unknown): ToolSettingOption[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value
    .map((item) => {
      const record = item as Record<string, unknown>;
      const optionValue = String(record.value ?? "");
      const label = String(record.label ?? optionValue);
      return optionValue ? { value: optionValue, label } : null;
    })
    .filter((item): item is ToolSettingOption => Boolean(item));
}

function normalizeVisibleWhen(value: unknown): ToolSettingVisibleWhen | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  if (!record.field || record.equals === undefined) {
    return undefined;
  }

  return {
    field: String(record.field),
    equals: record.equals as string | number | boolean
  };
}

function normalizeSettings(content: string) {
  return parseObjectArray(content, "settings")
    .map((item) => {
      const id = String(item.id ?? "");
      if (!id) {
        return null;
      }
      const field: ToolSettingField = {
        id,
        label: String(item.label ?? id),
        type: String(item.type ?? "text"),
        required: Boolean(item.required ?? false),
        default: item.default === undefined ? "" : (item.default as ToolSettingValue),
        description: String(item.description ?? ""),
        placeholder: item.placeholder ? String(item.placeholder) : undefined,
        options: normalizeOptions(item.options),
        min: typeof item.min === "number" ? item.min : undefined,
        max: typeof item.max === "number" ? item.max : undefined,
        step: typeof item.step === "number" ? item.step : undefined,
        accept: item.accept ? String(item.accept) : undefined,
        itemType: ["text", "file"].includes(String(item.itemType ?? ""))
          ? (String(item.itemType) as ToolSettingField["itemType"])
          : undefined,
        itemLabel: item.itemLabel ? String(item.itemLabel) : undefined,
        valueKey: item.valueKey ? String(item.valueKey) : undefined,
        showItemSummary: Boolean(item.showItemSummary ?? false),
        summaryCountKey: item.summaryCountKey ? String(item.summaryCountKey) : undefined,
        summaryRangeKey: item.summaryRangeKey ? String(item.summaryRangeKey) : undefined,
        pendingSummaryLabel: item.pendingSummaryLabel ? String(item.pendingSummaryLabel) : undefined,
        pendingRangeLabel: item.pendingRangeLabel ? String(item.pendingRangeLabel) : undefined,
        program: item.program ? String(item.program) : undefined,
        visibleWhen: normalizeVisibleWhen(item.visibleWhen),
        section: item.section ? String(item.section) : undefined,
        advanced: Boolean(item.advanced ?? false),
        preview: Boolean(item.preview ?? false),
        confirmOnChange: Boolean(item.confirmOnChange ?? false)
      };
      const options = defaultSettingOptions(field);
      field.hidden =
        Boolean(item.hidden ?? false) ||
        ((isSelectLikeSetting(field.type) || field.type === "multi-select") && options.length === 1);
      return field;
    })
    .filter((field): field is ToolSettingField => Boolean(field));
}

function normalizeActions(content: string): ToolExecutionAction[] {
  return parseObjectArray(content, "actions")
    .map((item) => {
      const id = String(item.id ?? "");
      if (!id) {
        return null;
      }
      return {
        id,
        label: String(item.label ?? id),
        runtimeAction: String(item.runtimeAction ?? id),
        description: String(item.description ?? ""),
        primary: Boolean(item.primary ?? false),
        requiresPreview: Boolean(item.requiresPreview ?? false),
        confirm: Boolean(item.confirm ?? false)
      };
    })
    .filter((action): action is ToolExecutionAction => Boolean(action));
}

function normalizeResultFields(content: string, key: string): ToolResultField[] {
  return parseObjectArray(content, key)
    .map((item) => {
      const id = String(item.id ?? "");
      if (!id) {
        return null;
      }
      return {
        id,
        label: String(item.label ?? id),
        type: String(item.type ?? "text")
      };
    })
    .filter((field): field is ToolResultField => Boolean(field));
}

function parseResultSchema(content: string): ToolResultSchema {
  const lines = blockLines(content, "resultSchema");
  const fields: ToolResultField[] = [];
  let resultType = defaultToolRuntimeSchema.resultSchema.type;
  let current: Partial<ToolResultField> | null = null;

  for (const line of lines) {
    const typeLine = line.match(/^\s{2}type:\s*(.*)$/);
    if (typeLine) {
      resultType = String(parseScalar(typeLine[1]) || resultType);
      continue;
    }

    const fieldItem = line.match(/^\s{4}-\s+id:\s*(.*)$/);
    if (fieldItem) {
      if (current?.id) {
        fields.push({
          id: current.id,
          label: current.label ?? current.id,
          type: current.type ?? "text"
        });
      }
      current = { id: String(parseScalar(fieldItem[1])) };
      continue;
    }

    const fieldProperty = line.match(/^\s{6}([A-Za-z0-9_-]+):\s*(.*)$/);
    if (fieldProperty && current) {
      const value = String(parseScalar(fieldProperty[2]));
      if (fieldProperty[1] === "label") {
        current.label = value;
      }
      if (fieldProperty[1] === "type") {
        current.type = value;
      }
    }
  }

  if (current?.id) {
    fields.push({
      id: current.id,
      label: current.label ?? current.id,
      type: current.type ?? "text"
    });
  }

  return { type: resultType, fields };
}

function parseFailurePolicy(content: string): ToolFailurePolicy {
  const lines = blockLines(content, "failurePolicy");
  const policy = { ...defaultToolRuntimeSchema.failurePolicy };

  lines.forEach((line) => {
    const property = line.match(/^\s{2}([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!property) {
      return;
    }

    const key = property[1];
    const value = parseScalar(property[2]);
    if (
      key === "partialSuccess" &&
      ["report", "rollback", "keep-success"].includes(String(value))
    ) {
      policy.partialSuccess = value as ToolFailurePolicy["partialSuccess"];
    }
    if (key === "rollback" && ["none", "transaction", "backup", "manual"].includes(String(value))) {
      policy.rollback = value as ToolFailurePolicy["rollback"];
    }
    if (key === "log") {
      policy.log = Boolean(value);
    }
  });

  return policy;
}

function normalizeStringRecord(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>(
    (record, [key, item]) => {
      record[key] = String(item ?? "");
      return record;
    },
    {}
  );
}

export function parseToolRuntimeSchema(content: string): ToolRuntimeSchema {
  const risk = topLevelScalar(content, "risk") || defaultToolRuntimeSchema.risk;
  const executionMode = topLevelScalar(content, "executionMode") || defaultToolRuntimeSchema.executionMode;

  return {
    ...defaultToolRuntimeSchema,
    risk: ["read", "create", "modify", "bulk-modify", "delete", "safe", "caution"].includes(risk)
      ? (risk as ToolRuntimeSchema["risk"])
      : "read",
    executionMode: ["manual", "mcp", "custom-flow", "hybrid"].includes(executionMode)
      ? (executionMode as ToolRuntimeSchema["executionMode"])
      : "manual",
    requiredServers: parseSimpleStringArray(content, "requiredServers"),
    mcpCommands: parseObjectArray(content, "mcpCommands").map((item) => ({
      server: String(item.server ?? ""),
      command: String(item.command ?? ""),
      status: ["available", "manual"].includes(String(item.status ?? "planned"))
        ? (String(item.status) as ToolMcpCommand["status"])
        : "planned",
      params: normalizeStringRecord(item.params),
      condition: item.condition ? String(item.condition) : undefined
    })),
    preflightChecks: parseObjectArray(content, "preflightChecks").map((item) => ({
      id: String(item.id ?? ""),
      label: String(item.label ?? item.id ?? "검증"),
      severity: ["error", "info"].includes(String(item.severity ?? "warning"))
        ? (String(item.severity) as ToolPreflightCheck["severity"])
        : "warning",
      message: String(item.message ?? ""),
      fix: item.fix ? String(item.fix) : undefined,
      blocksExecution: item.blocksExecution === undefined ? undefined : Boolean(item.blocksExecution)
    })).filter((item) => item.id),
    resultSchema: parseResultSchema(content),
    failurePolicy: parseFailurePolicy(content),
    settingsLayout: parseSettingsLayout(content),
    settings: normalizeSettings(content),
    actions: normalizeActions(content),
    inputs: normalizeResultFields(content, "inputs"),
    outputs: normalizeResultFields(content, "outputs"),
    testCases: parseObjectArray(content, "testCases").map((item) => ({
      name: String(item.name ?? "테스트"),
      given: String(item.given ?? ""),
      expect: String(item.expect ?? "")
    }))
  };
}
