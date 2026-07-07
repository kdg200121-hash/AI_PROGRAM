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

  it("maps executable result types to Custom Flow port types", () => {
    expect(flowPortTypeFromToolType("cad_object_handles")).toBe("cad");
    expect(flowPortTypeFromToolType("revit_element_ids")).toBe("revit");
    expect(flowPortTypeFromToolType("mapping-table")).toBe("table");
  });
});
