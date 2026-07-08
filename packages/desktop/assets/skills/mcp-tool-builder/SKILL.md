---
name: mcp-tool-builder
description: Use when creating or refining AI Program MCP tool Markdown files for Custom Tools, More Tools, add-in conversion, or `/make` requests.
---

# MCP Tool Builder

Use this skill to turn an idea, add-in behavior, existing chat, or workflow into an AI Program-compatible MCP tool Markdown file.

## Command Trigger

When the user types `/make <tool name>`, start building a new MCP tool draft for that tool name.

When the user types only `/make` or asks to make an MCP tool without a name, do not invent a final name silently. First inspect the current conversation and propose 2-4 concise Korean tool-name candidates with one recommended option. If the conversation does not contain enough context, ask what the tool should be called and offer practical examples.

If the user provides a partial or vague name, normalize it into a short file-safe tool title, then confirm it before writing the MD file.

The approved Korean tool name is the display name. Put it exactly in frontmatter `toolName` and in the first Markdown heading. Do not replace it with an English filename, slug, command id, or translated title. English or romanized text may be used only for the saved file name, safe id, or MCP command names.

## Core Rule

Do not guess missing execution-critical information. If a missing value can change the result, ask the user. If the user is non-technical, propose 2-4 clear candidates and ask them to choose.

The finished tool must be deterministic: another person using the same settings, same input files/objects, and same MCP environment should get the same result.

Only put a value in `settings` when the user should actually choose or edit it in the settings window. If the value is fixed by the tool design, derived from other inputs, or represents which button the user clicked, keep it out of `settings` and document it as a fixed constant, derived preview value, or `runtime` action in the MCP command mapping.

If a select-like field has only one possible option, it is not a setting. Do not create a visible field for it. Put that single value directly in MCP params/body text as a fixed constant.

Preview/analyze flows must be modeled as actions, not as user settings. For example, use buttons such as `분석 미리보기` and `원본에 적용`; map the preview button to `runtime.action == "preview"` or an equivalent execution state. Do not add a `preview_only` / `dry-run` checkbox unless the user genuinely needs to choose between preview-only and applying from the same execution button.

Do not render the same preview/apply action in multiple places. If an execution step has `actionId`, show its button only in the execution step/action area for that step. Do not also add another `분석 미리보기`, `실행`, or `원본에 적용` button inside a settings section or candidate-selection panel.

Do not add an extra internal workflow strip such as `입력 / 미리보기 / 실행` inside the selected action panel. The full-width top `실행 단계` panel is the only place that should show the workflow order. The lower selected-step panel should contain only the controls and results for the currently selected step.

When converting AI CAD or AI Revit add-ins, choose the UI pattern from the add-in's actual behavior:

- Read-only, export, report, or one-shot create tools: use a simple or sectioned settings form plus a result panel.
- Bulk modify, delete, overwrite, model-changing, or file-changing tools: use a workflow panel with `입력` → `분석 미리보기` → `원본에 적용`; the apply action stays disabled until preview exists.
- Tools that require user picking in CAD/Revit before execution: show the pick state as an input/source control, not as a free-text setting.
- Add-in constants such as Revit version support, fixed object type, fixed sort order, fixed tolerance, or increment `1` belong in body text and MCP params, not in visible settings.

Always generate a short Korean `description` automatically when the user did not explicitly provide one. Derive it from the target program, input/source, core action, and output/result. Use one sentence under 120 Korean characters when possible. Example: `여러 DWG에서 도곽 기준 위치의 Text/MText 도면번호를 순서대로 일괄 변경합니다.`

If you ask multiple items and the user answers only some of them, do not silently skip the unanswered item. Restate the missing item, explain why it matters, and offer 2-4 practical choices plus one recommended option. Continue only after the missing item is answered or the user explicitly says to use the recommended option.

Prefer choice-based questions for most decisions. Do not ask open-ended questions unless the user is clearly technical or the answer cannot be reasonably narrowed. Each choice question should include:

- 2-4 practical options.
- One option marked as recommended.
- A short explanation of what changes depending on the choice.
- A final “직접 입력” option only when the provided choices may not fit.

Example:

```text
작업 범위는 어떻게 할까요?
1. 현재 선택한 객체만 사용 (추천): 실수로 전체 도면/모델을 건드릴 위험이 낮습니다.
2. 현재 뷰 전체 사용: 화면에 보이는 범위를 한 번에 처리합니다.
3. 전체 파일/모델 사용: 빠르지만 변경 범위가 넓어 확인창이 필요합니다.
4. 직접 입력: 다른 기준이 있으면 적어주세요.
```

## Novice User Mode

Assume the user may not know MCP, schema, ports, parameters, or command names. Do not ask technical questions first.

For non-technical users:

- Ask in plain Korean using real work terms such as 도면, 모델, 선택 객체, 파일, 결과표, 저장 위치.
- Convert the user's answers into technical fields yourself, then show a short confirmation.
- When a technical value is required, propose 2-4 candidates instead of asking the user to name it.
- Use “제가 보기엔 이렇게 잡으면 됩니다” only for non-destructive defaults. For create/modify/delete/bulk changes, ask for explicit confirmation.
- Ask at most 2-3 related questions at once. If the user answers only one, repeat the missing item with choices.
- Do not ask “MCP 명령 이름은 무엇인가요?” to a novice. Instead propose planned command names such as `cad.read_selected_objects`, `revit.update_parameters`, or `excel.write_table`.
- Explain why a question matters only in one short sentence.

Starter flow for a novice:

1. “어느 프로그램에서 쓸까요?” CAD, Revit, Excel, Tekla, Custom Flow, Other.
2. “읽기만 하나요, 새로 만들거나 수정하나요?” 읽기 전용, 파일 생성, 원본 수정, 대량 수정, 삭제/덮어쓰기.
3. “대상은 어디서 가져올까요?” 현재 선택, 현재 파일 전체, 현재 뷰, 파일 선택, 폴더 선택, 이전 노드 결과.
4. “결과는 어디로 보낼까요?” 화면 표시, Excel/CSV/JSON 파일, 다음 노드, CAD/Revit 모델 수정, 로그.
5. Decide the UI pattern: simple form, sectioned form, or workflow actions (`입력` → `분석 미리보기` → `원본에 적용`) based on read/create/modify risk.
6. Then propose the settings layout, MCP command plan, ports, and preflight checks for confirmation.

Minimum information before writing:

- Tool name or approved candidate name.
- Target program/menu.
- Whether it reads, creates, modifies, bulk modifies, or deletes.
- Input source and required user selection/file.
- Output/result type.
- Required MCP server or planned server.
- At least one preflight check.
- Failure behavior.

If any minimum item is missing, do not write the MD file yet.

## Workflow

1. Identify the target: CAD, Revit, Custom Flow, Excel, Tekla, or Other.
2. Ask what the tool does in one sentence.
3. Define the exact input source: active file, selected object, file path, folder, model element, sheet/range, coordinates, or previous node output.
4. Extract the full planned tool specification and get user approval before any file is written.
5. Define the settings panel using the schema and layout rules in `references/ai-program-md-tool.md`.
6. Create an HTML settings-window mockup and get user approval before writing the MD file.
7. Define the MCP command plan: required server, command names, parameters, execution order, and fallback when a command is unavailable.
8. Define outputs: displayed result, saved file, modified model/drawing, log, or Custom Flow output port.
9. Identify risks: read-only, file creation, original data modification, bulk edit, delete, overwrite, export, parameter changes, model changes, or broad document edits.
10. Define preflight checks, result schema, test cases, and failure/rollback policy.
11. Write the MD tool with YAML frontmatter, purpose, operation flow, settings layout, settings schema, command plan, input/output ports, execution conditions, expected result, and failure handling.
12. Before finalizing, review whether someone who did not see the chat could run the tool safely and repeatably.

## Required Question Flow

Ask in Korean unless the user requests another language. Ask one or a few related questions at a time.

### 1. Target and Purpose

- 어느 프로그램에서 쓰는 툴인가요? CAD, Revit, Custom Flow, Excel, Tekla, Other 중에서 골라주세요.
- 이 툴은 한 문장으로 무엇을 하나요?
- 이 툴을 언제 사용하면 되나요? 사용하지 말아야 하는 상황도 있나요?

### 2. Input Source

- 실행 전에 사용자가 선택하거나 입력해야 하는 값은 무엇인가요?
- 입력은 어디서 오나요? 활성 파일, 파일 선택, 폴더 선택, 현재 선택 객체, 현재 뷰, Excel 범위, 이전 노드 결과 중 무엇인가요?
- 입력값이 여러 개면 순서와 이름을 정해주세요.
- 기본값이 가능한 항목은 무엇이고, 반드시 입력해야 하는 항목은 무엇인가요?

### 3. Settings Panel

Design the settings panel so a non-developer can understand it without reading the whole MD file. Use sections, collapsed advanced options, conditional fields, repeatable rows, and preview fields when they make the tool safer or easier.

First ask which layout fits best:

1. 기본 설정만 표시 (추천): 필수 입력값이 적고 간단한 툴에 적합합니다.
2. 기본/고급 설정 분리: 자주 쓰는 값은 위에, 위험하거나 세부적인 값은 접어서 숨깁니다.
3. 단계별 설정: 입력 선택, 필터, 실행 옵션, 결과 저장처럼 순서가 중요한 툴에 적합합니다.
4. 반복 테이블 설정: 레이어-파라미터 매핑처럼 여러 줄을 추가해야 하는 툴에 적합합니다.

For AI CAD/Revit add-ins, do not force every add-in into the same layout. Use `simple` or `sections` for read/export/report tools. Use a workflow/action layout for tools that first analyze the active drawing/model and then modify original CAD/Revit data. Use `steps` only when the user must complete real sequential choices, not merely because the tool is important.

For every setting field ask:

- 화면에 보일 이름은 무엇인가요?
- 값 종류는 무엇인가요? `text`, `textarea`, `number`, `checkbox`, `select`, `multi-select`, `file`, `folder`, `scope-picker`, `object-selection`, `element-selection`, `range-selection`, `coordinate`, `coordinate-system`, `color`, `unit`, `tolerance`, `layer`, `level`, `family-type`, `parameter`, `repeatable-list`, `mapping-table`, `filter-builder`, `sort-rule`, `naming-template`, `overwrite-policy`, `conflict-policy`, `backup-policy`, `transaction-policy`, `dry-run`, `version-compatibility` 중에서 고릅니다.
- 필수인가요?
- 기본값은 무엇인가요?
- 선택지나 허용 범위가 있나요?
- 값이 비어 있거나 잘못되면 어떤 메시지를 보여줘야 하나요?
- 이 설정은 특정 조건에서만 보여야 하나요?
- 어느 섹션에 들어가야 하나요? 예: 입력, 필터, 실행 옵션, 결과, 고급 설정.
- 고급 설정으로 접어둘까요?
- 실행 전 미리보기나 요약에 표시해야 하나요?

Before accepting a field as a visible setting, classify it:

- `visible setting`: the user can choose it and different choices are meaningful.
- `single-option value`: a select/select-like value with only one possible option; treat it as a fixed constant, not a visible setting.
- `fixed constant`: the tool always uses this value, such as increment `1` or a fixed Text/MText target.
- `derived result`: the UI displays it after analysis, such as `미분석`, `미리보기 필요`, 도곽 수, or 번호 범위.
- `runtime action`: the value comes from the clicked button, such as `분석 미리보기` versus `원본에 적용`.

Only `visible setting` belongs in frontmatter `settings`. The other categories belong in descriptions, row summary metadata, result schema, or MCP parameter mapping.

### 3-1. Full Tool Spec Confirmation

After the required settings, inputs, outputs, command plan, risks, and failure behavior are mostly clear, stop and show the full extracted tool specification in Korean before writing any file.

The review must include:

- Tool name and target menu/program.
- Display metadata: approved Korean `toolName`, safe filename/id, and auto-generated Korean `description`.
- Purpose and one-sentence user workflow.
- Input source, required selections/files, and file/object scope.
- Settings sections and fields, including defaults and required values.
- Execution steps shown on the tool page. Each step must have `id`, `label`, `description`, and when relevant `section` or `actionId`.
- MCP server and command plan. Mark unavailable commands as `planned`.
- Outputs, result schema, logs, and Custom Flow ports if relevant.
- Risk level, overwrite/backup behavior, preflight checks, failure policy, and rollback/logging behavior.
- At least one concrete test case with expected result.

Then ask:

```text
위 전체 도구 사양으로 진행할까요?
1. 그대로 진행 (추천)
2. 항목 추가
3. 항목 제거
4. 순서나 방식 변경
```

Do not create the MD tool or settings mockup file until the user approves this full specification. If the user requests changes, update the specification and ask again.

### 3-2. HTML Settings Mockup Confirmation

After the full tool specification is approved, create a real HTML settings-window mockup and show the local file link before writing the final MD tool.

HTML mockup requirements:

- Save the file under the current workspace, preferably `outputs/<safe-tool-name>-settings-mockup.html`.
- Use a realistic AI Program settings-window layout, not a plain text mockup.
- Match the current AI Program tool page layout: put `실행 단계` in a full-width horizontal panel at the top. Show selectable steps such as `1 설정 입력`, `2 미리보기`, `3 후보 선택`, `4 적용`.
- Put the editable controls for the selected step in the large lower panel. Each step should point to a `settingsLayout.sections[].id` through `executionSteps[].section`, or to a button/action through `executionSteps[].actionId`.
- If the settings window shows preset/profile buttons such as `저장` and `불러오기`, place them in the selected-step panel header on the far right. Do not center them between the title/description and the empty right side.
- Make each selected-step panel visually and functionally distinct. An input step should show user-editable controls; a preview/action step should show analysis status, result summaries, and the single relevant action; a candidate/confirmation step should show detected candidates and selection controls. Do not duplicate the same input form for candidate review unless the user is actually editing those same values again.
- Do not place a second workflow summary row inside the selected-step panel. If the top `실행 단계` already shows `설정 입력`, `분석 미리보기`, `후보 확인`, and `원본에 적용`, the lower panel must not repeat simplified cards such as `입력`, `미리보기`, and `실행`.
- Mix operation-principle explanation into each execution step description. Do not create a separate old-style `작동 원리` panel.
- Design custom tool settings so they fit inside the lower selected-step panel. Group fields into clear sections, keep long tables/lists scrollable, and avoid assuming the settings panel is a narrow right sidebar.
- Show the actual sections, fields, buttons, warnings, preview/result area, and disabled/enabled states implied by the tool.
- For detected-object workflows such as CAD title block candidates or Revit element candidates, the candidate step must be a review/selection view based on analysis results. It should not look like the original settings input step. Show candidate names, counts, confidence/status, selected object handles/ids, and a clear confirm-selection control.
- For list-based tools, show add/delete/reorder controls when relevant.
- For file-list settings, `항목 추가` must open a file picker and store the selected file paths as list item values. Use `type: repeatable-list`, `itemType: file`, `valueKey: file_path`, and an `accept` filter such as `.dwg,.dxf` when the list is a set of files.
- When a file-list tool can calculate per-file preview results, add row summary metadata such as `showItemSummary: true`, `summaryCountKey: title_block_count`, `summaryRangeKey: number_range`, `pendingSummaryLabel`, and `pendingRangeLabel`. Show these badges in the HTML mockup beside each file row, not as a separate long table.
- For tools with a safe analysis step and a later modifying step, show two clear actions: `분석 미리보기` for non-saving analysis and `원본에 적용` for the confirmed modification. The apply action should look disabled until preview results exist.
- Keep dense review-only information compact. Put execution summary, preflight checks, validation, and test summary behind one compact review/icon area, and expand each detail only when the user clicks its icon.
- For destructive, overwrite, bulk edit, delete, or model-changing tools, show a visible warning and final confirmation area.
- Keep the mockup self-contained with inline CSS so it opens directly in a browser.

Then ask:

```text
이 HTML 설정창 구성으로 진행할까요?
1. 그대로 진행 (추천)
2. 항목 추가
3. 항목 제거
4. 배치나 흐름 변경
```

Do not write the final MD tool until the user approves the HTML settings mockup. If the user requests changes, update the HTML mockup and ask again.

### 4. MCP Command Plan

Ask enough to make the tool executable later:

- 어떤 MCP 서버가 필요하나요? 예: CAD, Revit, Excel, Tekla, Custom Flow.
- 호출할 MCP 명령 이름은 무엇인가요? 초보 사용자에게 직접 묻지 말고 후보 이름을 제안한 뒤 `planned`로 표시하세요.
- 명령에 넘길 파라미터는 어떤 설정값/입력값에서 오나요?
- 여러 명령을 순서대로 실행하나요, 병렬로 실행하나요?
- MCP 서버가 연결되지 않았거나 명령이 없으면 어떤 메시지를 보여줘야 하나요?
- 명령 실행 전에 필요한 프로그램 상태는 무엇인가요? 예: Revit 모델 열림, CAD 객체 선택, Excel 파일 저장됨.

### 5. Output and Custom Flow Ports

- 실행 결과는 어디에 표시되거나 저장되나요?
- 다음 노드로 넘길 값이 있나요? 예: Excel 파일, CAD 객체 목록, Revit 요소 ID, 숫자, 텍스트, JSON, 로그.
- Custom Flow에서 입력/출력 포트가 필요하면 포트 이름, 타입, 방향을 정하세요.
- 결과 형식은 무엇인가요? `text`, `table`, `json`, `file`, `cad_object_handles`, `revit_element_ids`, `excel_range`, `log` 중에서 고릅니다.

### 6. Safety, Validation, and Failure

- 원본 파일, CAD 도면, Revit 모델, Excel 셀을 수정하나요?
- 생성/삭제/이동/이름 변경/덮어쓰기/일괄 수정이 있나요?
- 실행 전 확인창이 필요한가요?
- 실패 시 사용자에게 보여줄 메시지는 무엇인가요?
- 일부만 성공했을 때 되돌릴 수 있나요, 아니면 로그만 남기나요?
- 실행 전 검증에서 막아야 하는 조건은 무엇인가요?
- 최소 테스트 예시는 무엇인가요? 같은 입력과 같은 설정으로 예상 결과를 적으세요.

## Final Quality Gate

Before writing or saying the tool is ready, check:

- A novice can understand what to click or select.
- Every execution step has a different purpose on screen. `설정 입력` gathers editable inputs, `분석 미리보기` runs or displays analysis, `후보 확인` selects detected objects/results, and `원본에 적용` confirms modification. If two step panels look the same, revise the mockup and MD before finalizing.
- Every visible `settings` field is something the user can meaningfully choose. Fixed values, derived preview badges, and clicked-button states are not settings.
- No select-like setting has only one option. Single-option values are fixed constants and must not take space in the settings window.
- Preview/analyze behavior is represented as an execution action or runtime state, not as an unnecessary `preview_only` checkbox.
- Preview/apply buttons are not duplicated across the step header, action step, and settings panel. There should be one clear place to run each action.
- The lower selected-step panel does not repeat the top workflow as compact cards. If a mockup shows both the top `실행 단계` and another `입력 / 미리보기 / 실행` row below it, remove the lower row.
- Settings preset/profile controls such as `저장` and `불러오기` are aligned to the far right of the selected-step header.
- The approved Korean tool name appears exactly in frontmatter `toolName`; any English slug is used only for filename/id.
- Frontmatter `description` is filled with a Korean one-sentence summary. Do not leave it blank or as `Short description`.
- No execution-critical value is hidden in prose only; it is represented in frontmatter or a clear section.
- CAD/Revit add-ins use the correct UI pattern: simple/sectioned for read or export, workflow actions for analyze-then-modify.
- `risk`, `requiredServers`, `mcpCommands`, `preflightChecks`, `settingsLayout`, `executionSteps`, `settings`, `inputs`, `outputs`, `resultSchema`, `failurePolicy`, and `testCases` are either filled or intentionally empty with a reason.
- All destructive or broad changes require confirmation.
- Units, scope, overwrite behavior, and result path are explicit when relevant.
- The body includes an “아직 구현/확인 필요” note for any `planned` command.

## Learning Log Metadata

When `/make` or tool conversion reveals repeated confusion, user corrections, or useful choice patterns, add a compact `learningLog` block to frontmatter. This is for future analytics and skill improvement, not for tool execution.

Capture:

- `observedFriction`: what slowed the user down or required repeated clarification.
- `suggestedOptions`: option sets the agent proposed and which one was recommended.
- `selectedOptions`: what the user chose or rejected.
- `deferredImprovements`: safe improvements to consider for future versions.

Never store secrets, personal chat snippets, file contents, tokens, or Codex thread identifiers in `learningLog`.

## Add-in Conversion Checklist

When converting an AI Revit or AI CAD add-in into MD tools, extract these items from chat history, code, screenshots, or user notes. Ask for anything missing.

### Revit Add-in Settings Candidates

- Revit 버전
- 현재 모델 또는 파일 경로
- 현재 뷰, 선택된 뷰, 3D 뷰
- 카테고리, 패밀리, 타입
- 레벨, 기준 레벨, 오프셋
- 작업 세트, 설계 옵션, 페이즈
- 선택 요소 범위: 현재 선택, 현재 뷰 전체, 전체 모델, 카테고리 필터
- 파라미터 이름과 값 매핑
- 공유 매개변수 파일, 매개변수 그룹
- 생성/수정/삭제 여부
- 트랜잭션 이름, Undo 단위
- 경고 무시 여부, 실패 처리 방식
- 결과 로그, 변경 요소 ID, 내보내기 경로

### CAD Add-in / AutoLISP Settings Candidates

- AutoCAD 버전
- 활성 DWG 또는 파일 경로
- Model Space / Paper Space
- 선택 객체 범위
- 객체 타입: Line, Polyline, Block, Text, MText, Dimension, Hatch, Point 등
- 레이어, 색상, 선종류, 블록명, 텍스트 스타일
- 좌표 기준, 단위, 허용 오차
- 중복/근접 판정 거리
- 수정 방식: 표시만, 새 레이어 생성, 객체 이동, 삭제, 블록 삽입, WBLOCK, Excel 내보내기
- 결과 레이어명, 오류 표시 색상
- 출력 파일 경로, CSV/Excel/JSON 형식
- Undo 처리와 원본 보존 여부

## References

Read `references/ai-program-md-tool.md` before writing the final MD tool. Use its settings schema and template.
