import {
  isSelectLikeSetting,
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
  condition?: string;
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

const modifyingActionWords = ["apply", "execute", "run", "write", "save", "delete", "적용", "실행", "저장", "삭제"];

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

function settingReference(value: string) {
  return value.match(/^settings\.([A-Za-z0-9_-]+)$/)?.[1] ?? "";
}

function addUniqueIssue(issues: ToolRuntimeIssue[], issue: ToolRuntimeIssue) {
  if (!issues.some((existing) => existing.id === issue.id)) {
    issues.push(issue);
  }
}

function addDuplicateIssues(
  issues: ToolRuntimeIssue[],
  ids: string[],
  type: "setting" | "action" | "step" | "section"
) {
  const seen = new Set<string>();
  ids.forEach((id) => {
    if (!id) {
      return;
    }
    if (seen.has(id)) {
      const labels = {
        setting: "설정",
        action: "액션",
        step: "실행 단계",
        section: "섹션"
      };
      addUniqueIssue(issues, {
        id: `duplicate-${type}-id-${id}`,
        severity: "error",
        title: `${labels[type]} ID 중복`,
        message: `'${id}' ${labels[type]} ID가 두 번 이상 사용되었습니다.`,
        fieldId: type === "setting" ? id : undefined
      });
    }
    seen.add(id);
  });
}

export function validateToolRuntimeSchema(schema: ToolRuntimeSchema): ToolRuntimeIssue[] {
  const issues: ToolRuntimeIssue[] = [];
  const isExecutable = ["mcp", "custom-flow", "hybrid"].includes(schema.executionMode);
  const requiredServers = new Set(schema.requiredServers);
  const settingIds = new Set(schema.settings.map((field) => field.id));
  const actionIds = new Set(schema.actions.map((action) => action.id));
  const sectionIds = new Set(schema.settingsLayout.sections.map((section) => section.id));

  addDuplicateIssues(
    issues,
    schema.settings.map((field) => field.id),
    "setting"
  );
  addDuplicateIssues(
    issues,
    schema.actions.map((action) => action.id),
    "action"
  );
  addDuplicateIssues(
    issues,
    (schema.executionSteps ?? []).map((step) => step.id),
    "step"
  );
  addDuplicateIssues(
    issues,
    schema.settingsLayout.sections.map((section) => section.id),
    "section"
  );

  if (isExecutable && schema.requiredServers.length === 0) {
    addUniqueIssue(issues, {
      id: "missing-required-servers",
      severity: "warning",
      title: "필요 MCP 서버 없음",
      message: "실행 가능한 툴인데 필요한 MCP 서버가 지정되어 있지 않습니다."
    });
  }

  if (riskyLevels.has(schema.risk) && schema.preflightChecks.length === 0) {
    addUniqueIssue(issues, {
      id: "missing-preflight-checks",
      severity: "warning",
      title: "실행 전 검증 없음",
      message: "원본을 만들거나 수정할 수 있는 툴은 실행 전 검증 조건이 필요합니다."
    });
  }

  if (riskyLevels.has(schema.risk) && schema.failurePolicy.rollback === "none") {
    addUniqueIssue(issues, {
      id: "weak-failure-policy",
      severity: "warning",
      title: "실패 처리 약함",
      message: "수정/삭제/저장 작업은 실패 시 되돌리기, 백업, 로그 정책을 명확히 정하는 편이 안전합니다."
    });
  }

  schema.mcpCommands.forEach((command, index) => {
    if (!command.server || !command.command) {
      addUniqueIssue(issues, {
        id: `invalid-command-${index + 1}`,
        severity: "error",
        title: "MCP 명령 정보 부족",
        message: `${index + 1}번째 MCP 명령의 서버 또는 명령 이름이 비어 있습니다.`
      });
    }

    if (command.server && !requiredServers.has(command.server)) {
      addUniqueIssue(issues, {
        id: `command-server-not-required-${command.server}`,
        severity: "warning",
        title: "MCP 서버 선언 누락",
        message: `${command.server} MCP 명령을 사용하지만 requiredServers에 포함되어 있지 않습니다.`
      });
    }

    Object.values(command.params ?? {}).forEach((value) => {
      const referencedSetting = settingReference(value);
      if (referencedSetting && !settingIds.has(referencedSetting)) {
        addUniqueIssue(issues, {
          id: `unknown-command-setting-${referencedSetting}`,
          severity: "error",
          title: "알 수 없는 설정 참조",
          message: `${command.command || "MCP 명령"}이 없는 설정값 '${referencedSetting}'을 참조합니다.`,
          fieldId: referencedSetting
        });
      }
    });
  });

  schema.settings.forEach((field) => {
    if (field.visibleWhen && !settingIds.has(field.visibleWhen.field)) {
      addUniqueIssue(issues, {
        id: `unknown-visible-when-${field.id}`,
        severity: "error",
        title: "표시 조건 참조 오류",
        message: `${field.label} 설정이 없는 조건 필드 '${field.visibleWhen.field}'을 참조합니다.`,
        fieldId: field.id
      });
    }

    if (field.section && sectionIds.size > 0 && !sectionIds.has(field.section)) {
      addUniqueIssue(issues, {
        id: `unknown-setting-section-${field.id}`,
        severity: "warning",
        title: "설정 섹션 없음",
        message: `${field.label} 설정이 없는 섹션 '${field.section}'에 배치되어 있습니다.`,
        fieldId: field.id
      });
    }

    if ((isSelectLikeSetting(field.type) || field.type === "multi-select") && field.options?.length === 1) {
      addUniqueIssue(issues, {
        id: `single-option-setting-${field.id}`,
        severity: "warning",
        title: "하나뿐인 선택 설정",
        message: `${field.label} 설정은 선택지가 하나뿐입니다. 사용자 설정이 아니라 고정값으로 옮기는 편이 좋습니다.`,
        fieldId: field.id
      });
    }
  });

  schema.actions.forEach((action) => {
    const actionKey = [action.id, action.runtimeAction, action.label].join(" ").toLowerCase();
    const isModifyingAction = modifyingActionWords.some((word) => actionKey.includes(word));
    if (riskyLevels.has(schema.risk) && isModifyingAction && !action.requiresPreview && !action.confirm) {
      addUniqueIssue(issues, {
        id: `unsafe-action-without-preview-${action.id}`,
        severity: "warning",
        title: "위험 액션 보호 부족",
        message: `${action.label} 액션은 원본을 바꿀 수 있는데 미리보기나 확인 조건이 없습니다.`
      });
    }
  });

  (schema.executionSteps ?? []).forEach((step) => {
    if (step.actionId && !actionIds.has(step.actionId)) {
      addUniqueIssue(issues, {
        id: `unknown-step-action-${step.actionId}`,
        severity: "error",
        title: "실행 단계 액션 없음",
        message: `${step.label} 단계가 없는 액션 '${step.actionId}'을 참조합니다.`
      });
    }

    if (step.section && sectionIds.size > 0 && !sectionIds.has(step.section)) {
      addUniqueIssue(issues, {
        id: `unknown-step-section-${step.section}`,
        severity: "warning",
        title: "실행 단계 섹션 없음",
        message: `${step.label} 단계가 없는 섹션 '${step.section}'을 참조합니다.`
      });
    }
  });

  if (isExecutable && schema.outputs.length === 0) {
    addUniqueIssue(issues, {
      id: "missing-outputs",
      severity: "warning",
      title: "출력 정의 없음",
      message: "실행 가능한 툴은 화면 표시, 파일, 로그, Custom Flow 포트 같은 출력 정의가 필요합니다."
    });
  }

  if (isExecutable && schema.testCases.length === 0) {
    addUniqueIssue(issues, {
      id: "missing-test-cases",
      severity: "warning",
      title: "테스트 예시 없음",
      message: "다른 사람이 같은 결과를 확인할 수 있도록 최소 하나의 테스트 예시를 넣는 편이 좋습니다."
    });
  }

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
      params,
      condition: command.condition
    };
  });
  const previewFields = schema.settings.filter((field) => !field.hidden && (field.preview || field.required));
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
