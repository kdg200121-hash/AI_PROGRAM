# AI Program MD Tool Reference

Use this reference when generating Markdown tools for AI Program Custom Tools or More Tools.

## Frontmatter

```yaml
---
tool: true
toolName: Tool Name
sectionId: cad
program: CAD
version: 1.0.0
author: GitHub-or-nickname
description: One short sentence.
risk: read
deterministic: true
executionMode: manual
requiredServers:
  - cad
mcpCommands:
  - server: cad
    command: cad.read_objects
    status: planned
    params:
      source: settings.selection_scope
preflightChecks:
  - id: cad_connected
    label: CAD MCP 서버 연결 확인
    severity: error
    message: CAD MCP 서버가 연결되어 있어야 합니다.
resultSchema:
  type: table
  fields:
    - id: name
      label: 이름
      type: text
failurePolicy:
  partialSuccess: report
  rollback: none
  log: true
settingsLayout:
  mode: sections
  sections:
    - id: input
      label: 입력
      defaultOpen: true
    - id: advanced
      label: 고급 설정
      defaultOpen: false
testCases:
  - name: 기본 실행
    given: 같은 입력과 같은 설정
    expect: 같은 결과 반환
inputs:
  - id: source
    label: 입력 객체
    type: object
outputs:
  - id: result
    label: 결과
    type: text
settings:
  - id: source_file
    label: 원본 파일
    type: file
    required: true
    default: ""
    description: 실행할 원본 파일입니다.
---
```

Use `risk: caution` when the tool can create, delete, move, rename, overwrite, export, batch edit, change model parameters, or modify user data.

Use `toolName` and `sectionId` as the primary app-facing metadata. `name` and `program` may be included for compatibility or readability, but AI Program reads `toolName` and `sectionId` first.

`toolName` is the visible display name in AI Program. Use the approved Korean tool name exactly. Do not put an English filename, slug, command id, or translated title in `toolName`. If `name` is included for compatibility, set it to the same Korean display name.

`description` must be filled. If the user did not provide a description, generate one Korean sentence from the target program, input/source, core action, and output/result. Do not leave it blank or as `Short description`.

Recommended risk levels:

- `read`: reads data only and does not create files.
- `create`: creates a new file, report, object, sheet, or view without changing existing data.
- `modify`: changes existing CAD/Revit/Excel/model data.
- `bulk-modify`: changes many objects, many cells, many model elements, or many files.
- `delete`: deletes or overwrites user data.

Use `risk: safe` only for older/simple tools. For new tools, prefer the more specific risk levels above.

## Executable Tool Fields

Use these fields when the tool should become executable by MCP later.

- `executionMode`: `manual`, `mcp`, `custom-flow`, or `hybrid`.
- `requiredServers`: MCP servers that must be connected before execution. Use lowercase names such as `cad`, `revit`, `excel`, `tekla`.
- `mcpCommands`: ordered list of MCP command calls.
- `preflightChecks`: validation checks before execution.
- `resultSchema`: the exact shape of the returned result.
- `failurePolicy`: what happens when execution fails or partially succeeds.
- `testCases`: minimal examples proving repeatable behavior.

`mcpCommands.status` should be:

- `available`: command exists and can be called now.
- `planned`: command name and parameters are designed, but implementation is not confirmed yet.
- `manual`: user must perform this step manually for now.

Example:

```yaml
mcpCommands:
  - server: revit
    command: revit.collect_elements
    status: planned
    params:
      category: settings.category
      scope: settings.selection_scope
  - server: excel
    command: excel.write_table
    status: planned
    params:
      path: settings.export_path
      rows: previous.result.rows
```

## Preflight Checks

Preflight checks prevent unsafe or confusing execution.

Required keys:

- `id`: stable key.
- `label`: Korean UI label.
- `severity`: `error`, `warning`, or `info`.
- `message`: Korean message shown to the user.

Recommended optional keys:

- `condition`: machine-readable condition when possible.
- `fix`: suggested action.
- `blocksExecution`: `true` or `false`.

Common checks:

- MCP server connected.
- Target program open.
- Active document/model available.
- Required selection exists.
- Required file path exists.
- Output folder exists.
- Unit and coordinate basis selected.
- Overwrite confirmation accepted.

## Result Schema

Define the result so Custom Flow can pass it to the next node.

Recommended result types:

- `text`
- `number`
- `boolean`
- `table`
- `json`
- `file`
- `folder`
- `cad_object_handles`
- `revit_element_ids`
- `excel_range`
- `log`

Example:

```yaml
resultSchema:
  type: table
  fields:
    - id: handle
      label: CAD 객체 핸들
      type: text
    - id: layer
      label: 레이어
      type: text
    - id: x
      label: X 좌표
      type: number
```

## Settings Schema

Every settings field should be explicit enough for the UI to render it and for another user to reproduce the same result.

Required keys:

- `id`: stable machine-readable key in snake_case or kebab-case.
- `label`: Korean UI label.
- `type`: field type.
- `required`: `true` or `false`.
- `default`: default value. Use `""`, `false`, `0`, or `[]` when empty.
- `description`: short help text.

Recommended optional keys:

- `placeholder`: input placeholder.
- `options`: select or multi-select choices.
- `min`, `max`, `step`: number constraints.
- `accept`: file extensions such as `.dwg,.dxf`.
- `itemType`: for `repeatable-list`, use `file` when each list row should be added from a file picker.
- `itemLabel`: optional per-row label for repeated list items.
- `valueKey`: for `repeatable-list`, the key used to store each row's value. Use `file_path` for file path lists that MCP commands need to read.
- `showItemSummary`: for `repeatable-list` file rows, show calculated per-file summary badges next to each file.
- `summaryCountKey`: row key for a count badge, such as `title_block_count`.
- `summaryRangeKey`: row key for a range badge, such as `number_range`.
- `pendingSummaryLabel`, `pendingRangeLabel`: labels shown before analysis/preview fills the summary values.
- `program`: `cad`, `revit`, `excel`, `tekla`, `common`.
- `visibleWhen`: condition for conditional display.
- `validationMessage`: message when the value is missing or invalid.
- `section`: settings section id.
- `advanced`: `true` when the field should be hidden under advanced settings.
- `preview`: `true` when the value should appear in the execution summary.
- `confirmOnChange`: `true` when changing the field can make the result dangerous.

Supported field types:

- `text`: short text.
- `textarea`: long text, prompt, memo, rule description.
- `number`: numeric value.
- `checkbox`: true/false option.
- `dry-run`: safe test-run checkbox.
- `select`: choose one option.
- `multi-select`: choose multiple options.
- `file`: file path.
- `folder`: folder path.
- `scope-picker`: current selection/current view/whole model/file/previous node source.
- `object-selection`: CAD/model object selection.
- `element-selection`: Revit element selection.
- `range-selection`: Excel/table range.
- `coordinate`: X/Y/Z or point.
- `coordinate-system`: internal origin/project base/survey/user coordinate basis.
- `color`: color or CAD/Revit display color.
- `unit`: mm, m, inch, or project-specific unit.
- `tolerance`: numeric tolerance for proximity, duplicate, or coordinate matching.
- `layer`: CAD layer.
- `level`: Revit level.
- `family-type`: Revit family/type.
- `parameter`: Revit or object parameter.
- `repeatable-list`: repeated rows such as mapping tables.
- `mapping-table`: source-to-target mapping such as Excel column to Revit parameter.
- `filter-builder`: one or more filter rules.
- `sort-rule`: sorting/grouping rules for reports or exports.
- `naming-template`: generated file/view/layer/name pattern.
- `overwrite-policy`: skip, overwrite, rename, or ask.
- `conflict-policy`: stop, skip, overwrite, or report on conflicts.
- `backup-policy`: whether to create backup before execution.
- `transaction-policy`: rollback/keep-success/manual review for model changes.
- `version-compatibility`: program/add-in version compatibility choice.

If a very specific field type is not listed, use the closest generic type (`text`, `textarea`, `select`, `repeatable-list`) and explain the intended behavior in `description`.

For a repeatable file list, do not model `항목 추가` as a blank text row. It should open a file picker and store selected paths in the list:

```yaml
settings:
  - id: dwg_files
    label: DWG 파일 목록
    type: repeatable-list
    itemType: file
    valueKey: file_path
    accept: .dwg,.dxf
    showItemSummary: true
    summaryCountKey: title_block_count
    summaryRangeKey: number_range
    pendingSummaryLabel: 미분석
    pendingRangeLabel: 미리보기 필요
    required: true
    default: []
    description: 항목 추가를 누르면 DWG 파일 선택창을 열고 선택한 경로를 목록에 저장합니다.
```

When a tool previews per-file results, fill each row with those summary keys. For example, a CAD drawing-number tool can update each row to `{ file_path, title_block_count, number_range }` so the UI shows `도곽 2개` and `P-101~P-102` beside that DWG.

## Settings Layout

Use `settingsLayout` to keep complex tools understandable. Prefer a simple layout for simple tools and grouped layouts for tools with many settings.

Supported modes:

- `simple`: one short settings panel.
- `sections`: grouped sections such as 입력, 필터, 실행 옵션, 결과, 고급 설정.
- `steps`: step-by-step settings for workflows where order matters.
- `table`: repeatable row-based settings, usually with `repeatable-list`.

Recommended section labels:

- `입력`
- `필터`
- `실행 옵션`
- `결과`
- `고급 설정`
- `안전 확인`

Example:

```yaml
settingsLayout:
  mode: sections
  sections:
    - id: input
      label: 입력
      defaultOpen: true
    - id: filter
      label: 필터
      defaultOpen: true
    - id: advanced
      label: 고급 설정
      defaultOpen: false
settings:
  - id: selection_scope
    label: 선택 범위
    type: select
    section: input
    required: true
    default: current_selection
    preview: true
    options:
      - value: current_selection
        label: 현재 선택
      - value: current_view
        label: 현재 뷰 전체
    description: 작업할 대상 범위를 선택합니다.
```

Example:

```yaml
settings:
  - id: selection_scope
    label: 선택 범위
    type: select
    required: true
    default: current_selection
    options:
      - value: current_selection
        label: 현재 선택
      - value: current_view
        label: 현재 뷰 전체
      - value: whole_model
        label: 전체 모델
    description: 작업할 대상 범위를 선택합니다.

  - id: export_excel
    label: Excel로 저장
    type: checkbox
    required: false
    default: true
    description: 결과를 Excel 파일로 저장합니다.

  - id: export_path
    label: 저장 경로
    type: folder
    required: true
    default: ""
    visibleWhen:
      field: export_excel
      equals: true
    description: Excel 결과 파일을 저장할 폴더입니다.
```

## Settings Mockup Confirmation

Before creating a final MD tool, show a mockup of the settings panel to the user. This confirmation should be written in Korean and should look like the actual app panel, not YAML.

Use this shape:

```text
설정창 목업

[입력]
- 선택 범위: 현재 선택
- 객체 타입: Line, Polyline, Block

[결과]
- 저장 위치: 폴더 선택
- 파일명 규칙: mcp_result_{date}.xlsx

[고급 설정]
- 단위: mm
- 허용 오차: 0

실행 전 점검
- CAD MCP 연결 확인
- 저장 폴더 확인
```

Then ask whether to proceed, add fields, remove fields, or reorganize sections. For destructive or broad tools, ask for one explicit risk confirmation even if the user approved the mockup.

## Body Template

```markdown
# Tool Name

## 목적

이 툴이 무엇을 하고 언제 사용하는지 설명합니다.

## 작동 원리

### 1. 입력 수집

필요한 파일, 선택 객체, 범위, 레이어, 파라미터, 사용자 설정값을 정리합니다.

### 2. MCP 명령 연결

준비된 입력값을 어떤 MCP 명령 또는 향후 구현할 명령으로 넘기는지 설명합니다.

### 3. 결과 확인

사용자가 실행 후 무엇을 보고, 무엇이 저장되고, 무엇이 로그에 남는지 설명합니다.

## 설정

설정 schema는 frontmatter의 `settings`에 정의합니다. 본문에는 사용자 설명을 적습니다.

## MCP 명령 계획

- Required servers:
- Command sequence:
- Parameter mapping:
- Fallback/manual step:

## 입력 포트

- Custom Flow에서 받을 입력 포트와 타입을 설명합니다.

## 출력 포트

- 다음 노드로 넘길 결과 포트와 타입을 설명합니다.

## 실행 조건

- Required MCP server:
- Required program state:
- Required file/selection:
- Preflight checks:

## 주의사항

- 원본을 바꾸는 작업이면 변경 범위와 확인 메시지를 명확히 적습니다.
- 안전한 읽기/정리 작업이면 “원본 데이터를 변경하지 않습니다.”라고 적습니다.

## 예상 결과

- 생성, 수정, 반환, 표시, 저장되는 결과를 적습니다.

## 실패 처리

- 입력 누락:
- MCP 미연결:
- 잘못된 설정값:
- 실행 중 오류:
- 일부 성공:
- 되돌리기/로그:

## 테스트 예시

- 입력:
- 설정:
- 예상 결과:
```

## Determinism Checklist

Before finalizing, verify:

- Same input values produce the same output.
- Required fields are marked `required: true`.
- Defaults are explicit.
- Selection scope is explicit.
- Units are explicit.
- File overwrite behavior is explicit.
- Result path and result type are explicit.
- Risk and confirmation behavior are explicit.
- Required MCP servers are explicit.
- MCP commands and parameter mapping are explicit or marked `planned`.
- Preflight checks are explicit.
- Result schema is explicit.
- At least one test case exists for non-trivial tools.
- Failure and partial-success behavior are explicit.

## AI Revit Add-in Conversion

When converting Revit add-ins to MD tools, look for:

- Revit version and required add-in version.
- Active model path or current model.
- Current view, selected view, or view template.
- Category, family, type, level, workset, phase, design option.
- Selection scope: current selection, current view, whole model, category filter.
- Parameter names, shared parameter file, value mapping, units.
- Create/update/delete behavior.
- Transaction name and undo behavior.
- Failure handling and warnings.
- Output: element IDs, changed count, report, Excel/CSV/JSON path.

Missing information to ask:

- “어떤 요소 범위에 적용하나요?”
- “기존 값을 덮어쓰나요, 비어 있는 값만 입력하나요?”
- “실행 전 확인창이 필요한 변경인가요?”
- “결과를 Revit 안에서만 보여주나요, 파일로 저장하나요?”

## AI CAD Add-in Conversion

When converting CAD add-ins or AutoLISP tools to MD tools, look for:

- AutoCAD version.
- Active DWG or file path.
- Model Space / Paper Space.
- Selection scope and object types.
- Layer, color, linetype, block name, text style.
- Coordinate basis, units, tolerance.
- Duplicate or proximity threshold.
- Whether to only mark results or modify/delete/move objects.
- Result layer name and color.
- Export format and path.
- Undo/original preservation behavior.

Missing information to ask:

- “작업 대상 객체는 무엇인가요?”
- “레이어/블록명/텍스트 조건이 있나요?”
- “허용 오차나 거리 기준은 몇인가요?”
- “원본 객체를 수정하나요, 새 레이어에 표시만 하나요?”
