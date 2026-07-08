import { describe, expect, it } from "vitest";
import type { ToolRuntimeSchema } from "./toolSettingsSchema";
import {
  buildToolExecutionPlan,
  validateToolRuntimeSchema,
  validateToolSettingsValues
} from "./toolRuntimeValidation";

const baseSchema: ToolRuntimeSchema = {
  risk: "read",
  executionMode: "mcp",
  requiredServers: ["cad"],
  mcpCommands: [
    {
      server: "cad",
      command: "cad.read_objects",
      status: "planned",
      params: {
        scope: "settings.selection_scope",
        layer: "settings.layer_name"
      }
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
    fields: [{ id: "handle", label: "핸들", type: "text" }]
  },
  failurePolicy: { partialSuccess: "report", rollback: "none", log: true },
  actions: [],
  settingsLayout: {
    mode: "sections",
    sections: [{ id: "input", label: "입력", defaultOpen: true }]
  },
  executionSteps: [],
  settings: [
    {
      id: "selection_scope",
      label: "선택 범위",
      type: "scope-picker",
      required: true,
      default: "current_selection",
      description: "읽을 범위입니다.",
      section: "input",
      preview: true
    },
    {
      id: "layer_name",
      label: "레이어",
      type: "layer",
      required: true,
      default: "",
      description: "읽을 레이어입니다.",
      section: "input",
      preview: true
    }
  ],
  inputs: [],
  outputs: [{ id: "result", label: "결과", type: "table" }],
  testCases: []
};

describe("toolRuntimeValidation", () => {
  it("reports missing required setting values before execution", () => {
    const issues = validateToolSettingsValues(baseSchema, {
      selection_scope: "current_selection",
      layer_name: ""
    });

    expect(issues).toEqual([
      expect.objectContaining({
        id: "missing-setting-layer_name",
        severity: "error",
        fieldId: "layer_name"
      })
    ]);
  });

  it("builds an MCP execution plan by resolving settings references", () => {
    const plan = buildToolExecutionPlan(baseSchema, {
      selection_scope: "current_view",
      layer_name: "A-WALL"
    });

    expect(plan.commands).toEqual([
      {
        index: 1,
        server: "cad",
        command: "cad.read_objects",
        status: "planned",
        params: {
          scope: "current_view",
          layer: "A-WALL"
        }
      }
    ]);
    expect(plan.summary).toContain("CAD MCP 연결 확인");
    expect(plan.sampleResult).toContain("table");
  });

  it("warns when a modifying tool has no rollback or preflight safety", () => {
    const issues = validateToolRuntimeSchema({
      ...baseSchema,
      risk: "modify",
      requiredServers: [],
      preflightChecks: [],
      failurePolicy: { partialSuccess: "report", rollback: "none", log: true }
    });

    expect(issues.map((issue) => issue.id)).toEqual(
      expect.arrayContaining([
        "missing-required-servers",
        "missing-preflight-checks",
        "weak-failure-policy"
      ])
    );
  });

  it("catches broken cross references in tool markdown schemas", () => {
    const issues = validateToolRuntimeSchema({
      ...baseSchema,
      requiredServers: ["cad"],
      mcpCommands: [
        {
          server: "revit",
          command: "revit.update_elements",
          status: "planned",
          params: {
            scope: "settings.missing_scope"
          }
        }
      ],
      actions: [
        {
          id: "apply",
          label: "실행",
          runtimeAction: "apply",
          description: "원본에 적용합니다.",
          primary: true,
          requiresPreview: false,
          confirm: false
        }
      ],
      executionSteps: [
        {
          id: "run",
          label: "실행",
          description: "없는 액션을 참조합니다.",
          actionId: "missing_action",
          state: "waiting"
        }
      ],
      settings: [
        ...baseSchema.settings,
        {
          id: "single_choice",
          label: "하나뿐인 선택",
          type: "select",
          required: false,
          default: "only",
          description: "고정값이어야 합니다.",
          options: [{ value: "only", label: "Only" }],
          section: "missing_section"
        },
        {
          id: "selection_scope",
          label: "중복 필드",
          type: "text",
          required: false,
          default: "",
          description: "중복입니다.",
          section: "input"
        }
      ],
      risk: "bulk-modify",
      outputs: [],
      resultSchema: { type: "text", fields: [] },
      testCases: []
    });

    expect(issues.map((issue) => issue.id)).toEqual(
      expect.arrayContaining([
        "duplicate-setting-id-selection_scope",
        "command-server-not-required-revit",
        "unknown-command-setting-missing_scope",
        "unknown-step-action-missing_action",
        "single-option-setting-single_choice",
        "unknown-setting-section-single_choice",
        "unsafe-action-without-preview-apply",
        "missing-outputs",
        "missing-test-cases"
      ])
    );
  });
});
