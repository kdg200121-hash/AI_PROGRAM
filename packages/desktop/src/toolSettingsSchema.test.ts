import { describe, expect, it } from "vitest";
import {
  defaultSettingOptions,
  flowPortTypeFromToolType,
  parseToolRuntimeSchema
} from "./toolSettingsSchema";

describe("toolSettingsSchema", () => {
  it("parses common settings fields from AI Program tool frontmatter", () => {
    const schema = parseToolRuntimeSchema(`---
tool: true
toolName: CAD 블록 좌표 수집
sectionId: cad
risk: read
executionMode: mcp
requiredServers:
  - cad
settingsLayout:
  mode: sections
  sections:
    - id: input
      label: 입력
      defaultOpen: true
settings:
  - id: selection_scope
    label: 선택 범위
    type: scope-picker
    required: true
    default: current_selection
    section: input
    preview: true
  - id: use_export
    label: Excel 저장
    type: checkbox
    required: false
    default: true
    section: input
  - id: overwrite_policy
    label: 기존 파일 처리
    type: overwrite-policy
    required: true
    default: rename
    advanced: true
    confirmOnChange: true
    visibleWhen:
      field: use_export
      equals: true
inputs:
  - id: source
    label: 입력 객체
    type: object
outputs:
  - id: result
    label: 결과표
    type: table
mcpCommands:
  - server: cad
    command: cad.read_blocks
    status: planned
    params:
      scope: settings.selection_scope
      overwrite: settings.overwrite_policy
preflightChecks:
  - id: cad_connected
    label: CAD MCP 연결
    severity: error
    message: CAD MCP 서버가 연결되어 있어야 합니다.
resultSchema:
  type: table
  fields:
    - id: handle
      label: 핸들
      type: text
    - id: x
      label: X 좌표
      type: number
failurePolicy:
  partialSuccess: rollback
  rollback: transaction
  log: true
---

# CAD 블록 좌표 수집`);

    expect(schema.executionMode).toBe("mcp");
    expect(schema.requiredServers).toEqual(["cad"]);
    expect(schema.settingsLayout.sections).toEqual([
      { id: "input", label: "입력", defaultOpen: true }
    ]);
    expect(schema.settings.map((field) => field.id)).toEqual([
      "selection_scope",
      "use_export",
      "overwrite_policy"
    ]);
    expect(schema.settings[2].confirmOnChange).toBe(true);
    expect(schema.settings[2].visibleWhen).toEqual({
      field: "use_export",
      equals: true
    });
    expect(schema.mcpCommands[0].params).toEqual({
      scope: "settings.selection_scope",
      overwrite: "settings.overwrite_policy"
    });
    expect(schema.inputs[0]).toMatchObject({ id: "source", type: "object" });
    expect(schema.outputs[0]).toMatchObject({ id: "result", type: "table" });
    expect(schema.resultSchema).toEqual({
      type: "table",
      fields: [
        { id: "handle", label: "핸들", type: "text" },
        { id: "x", label: "X 좌표", type: "number" }
      ]
    });
    expect(schema.failurePolicy).toEqual({
      partialSuccess: "rollback",
      rollback: "transaction",
      log: true
    });
    expect(schema.preflightChecks[0].severity).toBe("error");
  });

  it("provides practical defaults for specialized setting types", () => {
    expect(defaultSettingOptions({
      id: "unit",
      label: "단위",
      type: "unit",
      required: true,
      default: "mm",
      description: ""
    }).map((option) => option.value)).toEqual(["mm", "m", "inch"]);
  });

  it("parses repeatable file-list metadata for settings that open a file picker", () => {
    const schema = parseToolRuntimeSchema(`---
tool: true
toolName: CAD 도면번호 일괄 순번 변경
settings:
  - id: dwg_files
    label: DWG 파일 목록
    type: repeatable-list
    itemType: file
    valueKey: file_path
    showItemSummary: true
    summaryCountKey: title_block_count
    summaryRangeKey: number_range
    pendingSummaryLabel: 미분석
    pendingRangeLabel: 미리보기 필요
    accept: .dwg,.dxf
    required: true
    default: []
    description: 항목 추가를 누르면 DWG 파일 선택창을 열고 선택한 경로를 목록에 저장합니다.
---`);

    expect(schema.settings[0]).toMatchObject({
      id: "dwg_files",
      type: "repeatable-list",
      itemType: "file",
      valueKey: "file_path",
      showItemSummary: true,
      summaryCountKey: "title_block_count",
      summaryRangeKey: "number_range",
      pendingSummaryLabel: "미분석",
      pendingRangeLabel: "미리보기 필요",
      accept: ".dwg,.dxf"
    });
  });

  it("hides select-like settings that only expose one possible option", () => {
    const schema = parseToolRuntimeSchema(`---
tool: true
toolName: 단일 선택 제거
settings:
  - id: fixed_order
    label: 고정 순서
    type: select
    required: true
    default: top_left_to_bottom_right
    options:
      - value: top_left_to_bottom_right
        label: 좌상단 → 우하단
  - id: prefix
    label: 접두어
    type: text
    required: true
    default: P-
---`);

    expect(schema.settings.map((field) => field.id)).toEqual(["fixed_order", "prefix"]);
    expect(schema.settings[0].hidden).toBe(true);
    expect(schema.settings[1].hidden).toBe(false);
  });

  it("parses tool execution actions for preview/apply buttons", () => {
    const schema = parseToolRuntimeSchema(`---
tool: true
toolName: 실행 액션 테스트
actions:
  - id: preview
    label: 분석 미리보기
    runtimeAction: preview
    primary: true
    description: 저장 없이 변경 예정 목록만 계산합니다.
  - id: apply
    label: 원본에 적용
    runtimeAction: apply
    requiresPreview: true
    confirm: true
    description: 미리보기 확인 후 원본에 적용합니다.
---`);

    expect(schema.actions).toEqual([
      {
        id: "preview",
        label: "분석 미리보기",
        runtimeAction: "preview",
        description: "저장 없이 변경 예정 목록만 계산합니다.",
        primary: true,
        requiresPreview: false,
        confirm: false
      },
      {
        id: "apply",
        label: "원본에 적용",
        runtimeAction: "apply",
        description: "미리보기 확인 후 원본에 적용합니다.",
        primary: false,
        requiresPreview: true,
        confirm: true
      }
    ]);
  });

  it("ignores learningLog metadata when building runtime schema", () => {
    const schema = parseToolRuntimeSchema(`---
tool: true
toolName: Learning Log Test
learningLog:
  schemaVersion: "1"
  sourceSkill: "save-tool"
  observedFriction:
    - "사용자가 옵션 선택 기준을 다시 물어봄"
  suggestedOptions:
    - "1. 기본 설정 저장"
  selectedOptions:
    - "기본 설정 저장"
  deferredImprovements:
    - "설정창 목업 질문을 더 세분화"
settings:
  - id: dwg_files
    label: DWG 파일 목록
    type: repeatable-list
    itemType: file
    valueKey: file_path
    required: true
    default: []
actions:
  - id: preview
    label: 분석 미리보기
    runtimeAction: preview
    primary: true
---`);

    expect(Object.prototype.hasOwnProperty.call(schema, "learningLog")).toBe(false);
    expect(schema.settings.map((field) => field.id)).toEqual(["dwg_files"]);
    expect(schema.actions.map((action) => action.id)).toEqual(["preview"]);
  });

  it("maps executable result types to Custom Flow port types", () => {
    expect(flowPortTypeFromToolType("cad_object_handles")).toBe("cad");
    expect(flowPortTypeFromToolType("revit_element_ids")).toBe("revit");
    expect(flowPortTypeFromToolType("mapping-table")).toBe("table");
  });
});
