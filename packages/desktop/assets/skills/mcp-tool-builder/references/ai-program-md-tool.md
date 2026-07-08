# AI Program Markdown Tool Reference

Use this reference when generating Markdown tools for AI Program Custom Tools, Market Tools, and `/save` drafts.

The settings schema must be specific enough for AI Program to render a consistent 설정창 for different people's tools.

AI Program reads frontmatter first. The Markdown body explains the tool for people. Keep executable behavior in frontmatter whenever possible.

## Runtime Boundary

AI Program must ignore learningLog at runtime. `learningLog` is only analytics metadata for improving the tool-making skills later.

Never use `learningLog` to decide execution, settings, MCP commands, permissions, or risk.

## Recommended Frontmatter

```yaml
---
tool: true
toolName: "CAD 도면번호 일괄 순번 변경"
sectionId: "cad"
program: "CAD"
version: "1.0.0"
author: "GitHub-or-nickname"
description: "여러 DWG에서 도곽 기준 위치의 도면번호를 순서대로 일괄 변경합니다."
risk: "bulk-modify"
deterministic: true
executionMode: "mcp"
requiredServers:
  - cad
mcpCommands:
  - server: cad
    command: cad.titleBlocks.previewRenumber
    status: planned
    params:
      files: settings.dwg_files
      startNumber: settings.start_number
preflightChecks:
  - id: cad_connected
    label: CAD MCP 연결 확인
    severity: error
    message: CAD MCP 서버가 연결되어 있어야 합니다.
    blocksExecution: true
resultSchema:
  type: table
  fields:
    - id: file_path
      label: 파일
      type: file
    - id: title_block_count
      label: 도곽 수
      type: number
failurePolicy:
  partialSuccess: report
  rollback: backup
  log: true
settingsLayout:
  mode: sections
  sections:
    - id: input
      label: 입력
      defaultOpen: true
    - id: review
      label: 후보 확인
      defaultOpen: true
executionSteps:
  - id: input
    label: 설정 입력
    description: 실행할 파일과 번호 기준을 입력합니다.
    section: input
    state: active
  - id: preview
    label: 미리보기
    description: 원본을 바꾸기 전에 도곽 후보와 변경 예정 번호를 분석합니다.
    actionId: preview
    state: waiting
  - id: apply
    label: 실행
    description: 미리보기 결과가 맞으면 원본에 적용합니다.
    actionId: apply
    state: waiting
actions:
  - id: preview
    label: 미리보기
    runtimeAction: preview
    primary: true
    requiresPreview: false
    confirm: false
    description: 원본을 저장하지 않고 변경 예정 결과만 계산합니다.
  - id: apply
    label: 실행
    runtimeAction: apply
    primary: true
    requiresPreview: true
    confirm: true
    description: 미리보기 결과를 원본에 적용합니다.
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
    section: input
    preview: true
    description: 항목 추가 버튼으로 처리할 DWG 파일을 선택합니다.
  - id: start_number
    label: 시작 번호
    type: number
    required: true
    default: 1
    section: input
    preview: true
    description: 첫 도면에 적용할 시작 번호입니다.
inputs: []
outputs:
  - id: result
    label: 변경 결과
    type: table
testCases:
  - name: 두 개 DWG 미리보기
    given: DWG 2개와 시작 번호 1
    expect: 각 파일별 도곽 후보와 번호 범위가 표시된다.
learningLog:
  schemaVersion: "1"
  sourceSkill: "mcp-tool-builder"
  observedFriction: []
  suggestedOptions: []
  selectedOptions: []
  deferredImprovements: []
---
```

## Required Fields

- `tool: true`: marks the file as a tool.
- `toolName`: visible name in AI Program.
- `sectionId`: target menu such as `cad`, `revit`, `excel`, `tekla`, `custom-flow`, or `other`.
- `description`: short Korean sentence explaining target, action, and result.
- `risk`: `read`, `create`, `modify`, `bulk-modify`, `delete`, `safe`, or `caution`.
- `executionMode`: `manual`, `mcp`, `custom-flow`, or `hybrid`.
- `settingsLayout`, `executionSteps`, `settings`, `actions`: render the settings and execution UI.
- `requiredServers` and `mcpCommands`: tell the app and bridge which MCP server and command are needed.
- `preflightChecks`: block unsafe execution before calling MCP.
- `outputs` and `resultSchema`: let the app and Custom Flow understand returned data.
- `failurePolicy`: tells the user what happens on failure.
- `testCases`: proves repeatable behavior.

## Settings Rules

Only create visible `settings` for meaningful user choices.

Do not create settings for:

- Fixed constants, such as increment `1`.
- Single-option select values.
- Values derived from preview, such as detected title block count.
- The clicked button state, such as preview vs apply.

Use:

- `fixed constants` in body text or MCP params.
- `derived preview values` in result schema or row summary metadata.
- `runtime actions` in `actions` and `mcpCommands.condition`.

## Field Types

Supported common types:

- `text`, `textarea`, `number`, `checkbox`
- `select`, `multi-select`
- `file`, `folder`
- `scope-picker`
- `object-selection`, `element-selection`, `range-selection`
- `coordinate`, `coordinate-system`, `color`, `unit`, `tolerance`
- `layer`, `level`, `family-type`, `parameter`
- `repeatable-list`, `mapping-table`, `filter-builder`, `sort-rule`, `naming-template`
- `overwrite-policy`, `conflict-policy`, `backup-policy`, `transaction-policy`
- `version-compatibility`

If a field type is too specific, use the closest generic type and explain the exact behavior in `description`.

## Execution Steps

Use `executionSteps` to describe the page flow.

Good pattern for safe analysis then modification:

1. `설정 입력`: user-editable settings.
2. `미리보기`: calls preview/analyze action without changing original data.
3. `후보 확인`: shown only when detected candidates must be selected.
4. `실행`: applies changes after preview and confirmation.

Each step should have one purpose. Do not duplicate the top `실행 단계` row inside the selected-step panel.

## Actions

Use actions for buttons.

For risky apply actions:

- `requiresPreview: true`
- `confirm: true`
- `runtimeAction: apply` or a specific action name

Use `미리보기` and `실행` as default labels unless another domain phrase is clearer.

## MCP Commands

`mcpCommands.status`:

- `available`: command exists and can be called now.
- `planned`: command name and parameters are designed but implementation is not confirmed.
- `manual`: user must do the step manually for now.

Every command server should appear in `requiredServers`.

Every `settings.<id>` param reference must point to an existing visible setting.

Example:

```yaml
mcpCommands:
  - server: cad
    command: cad.inspect_title_blocks
    status: planned
    params:
      files: settings.dwg_files
    condition: runtime.action == "preview"
  - server: cad
    command: cad.apply_title_block_numbers
    status: planned
    params:
      files: settings.dwg_files
      startNumber: settings.start_number
    condition: runtime.action == "apply"
```

## Repeatable File Lists

For a list of files, use `repeatable-list` with `itemType: file`.

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
    description: 항목 추가 버튼으로 DWG 파일을 선택합니다.
```

Preview can fill rows with:

```json
{
  "file_path": "C:/drawings/A-101.dwg",
  "title_block_count": 2,
  "number_range": "001~002"
}
```

## Custom Flow Ports

Use `inputs` and `outputs` so a tool can be used as a Custom Flow node.

Common port types:

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

## Safety Checklist

Before finalizing:

- Every visible setting is meaningful.
- No select-like setting has only one option.
- Every id is unique.
- Every action and section reference is valid.
- Every command server is declared in `requiredServers`.
- Risky actions require preview or confirmation.
- Executable tools define outputs and at least one test case.
- Destructive or broad changes have preflight checks and failure policy.
- Candidate workflows do not invent candidates. They must use MCP/program data.

## Markdown Body Template

```markdown
# Tool Name

## 목적

이 툴이 무엇을 하고 언제 사용하는지 설명합니다.

## 실행 단계

### 1. 설정 입력

필요한 파일, 선택 범위, 기준값을 입력합니다.

### 2. 미리보기

원본을 바꾸기 전에 예상 결과와 후보를 확인합니다.

### 3. 실행

미리보기 결과가 맞으면 MCP 명령으로 실제 작업을 실행합니다.

## 설정 안내

주요 설정값과 선택 기준을 설명합니다.

## MCP 명령 계획

필요 서버, 명령 순서, 파라미터 매핑, 미구현 명령을 설명합니다.

## 실패 처리

연결 실패, 입력 누락, 일부 성공, 롤백/백업 정책을 설명합니다.
```

## Learning Log

`learningLog` is optional and non-executable.

Use it for anonymized observations:

- repeated confusion
- user corrections
- useful option sets
- future skill improvements

Do not include:

- secrets
- tokens
- personal chat excerpts
- full file contents
- Codex thread IDs
