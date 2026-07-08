---
name: mcp-tool-builder
description: Use when creating or refining AI Program MCP tool Markdown files for Custom Tools, Market Tools, add-in conversion, or `/make` requests.
---

# MCP Tool Builder

Use this skill when the user wants to create, convert, improve, or register an AI Program Markdown tool.

The goal is not to make a pretty document. The goal is to create a repeatable tool that another person can install, understand, configure, and execute safely.

## Command Trigger

When the user types `/make <tool name>`, start creating a tool draft for that name.

When the user types only `/make`, inspect the current conversation and propose 2-4 Korean tool-name candidates. Mark one option as recommended. Do not silently invent a final name.

The approved Korean tool name must be used exactly in frontmatter `toolName` and in the first Markdown heading. English or romanized text may be used only for file names, ids, and MCP command names.

## Core Behavior

Work like 스무고개처럼. Ask small, concrete questions until the tool is clear enough that a different user can run it without seeing the original chat.

Do not guess execution-critical information. If a missing value can change the result, ask. For non-technical users, offer choices instead of asking open-ended technical questions.

Only create visible `settings` for values the user can meaningfully choose. Fixed constants, single-option values, derived preview values, and clicked-button states do not belong in visible settings.

For preview/apply flows, model buttons as `actions` and connect them to `executionSteps`. Do not add a `dry-run` or `preview_only` setting unless the user truly needs one execution button with a user-selected mode.

## Novice User Flow

Ask in Korean by default. Use work words such as 도면, 모델, 선택 객체, 파일, 범위, 결과표, 저장 위치.

Ask at most 2-3 related questions at a time. If the user answers only part of them, repeat the missing item with choices.

Start with these questions:

1. 어느 프로그램에서 쓰는 툴인가요? CAD, Revit, Excel, Tekla, Custom Flow, Other 중에서 고릅니다.
2. 이 툴은 읽기만 하나요, 새로 만들거나 수정하나요? 읽기 전용, 파일 생성, 원본 수정, 대량 수정, 삭제/덮어쓰기 중에서 고릅니다.
3. 대상은 어디서 가져오나요? 현재 선택, 현재 파일 전체, 현재 뷰, 파일 선택, 폴더 선택, 이전 노드 결과 중에서 고릅니다.
4. 결과는 어디로 가나요? 화면 표시, Excel/CSV/JSON 파일, 다음 노드, CAD/Revit 모델 수정, 로그 중에서 고릅니다.
5. 실행 전에 미리보기나 후보 선택이 필요한가요?

## Required Tool Specification

Before writing any file, show a full Korean specification and get approval. Include:

- Tool name, target program/menu, safe file name/id.
- One-sentence description.
- Purpose and user workflow.
- Input source, required selections/files, and scope.
- Settings sections and fields with defaults and required flags.
- Fixed constants, derived preview badges, and runtime actions separated from editable settings.
- 실행 단계 shown on the tool page. Each step needs `id`, `label`, `description`, and either `section` or `actionId` when relevant.
- MCP server and command plan. Mark unverified commands as `planned`.
- Inputs, outputs, result schema, logs, and Custom Flow ports.
- Risk level, confirmation, preflight checks, failure policy, rollback/logging behavior.
- At least one concrete test case.
- `learningLog` entries when the conversation reveals useful future skill-improvement signals.

Ask:

```text
이 전체 도구 사양으로 진행할까요?
1. 그대로 진행 (추천)
2. 항목 추가
3. 항목 제거
4. 순서나 방식 변경
```

Do not write the final MD before approval.

## Settings Mockup Gate

After the specification is approved, create an HTML settings-window mockup before writing the final MD.

Mockup rules:

- Save under `outputs/<safe-tool-name>-settings-mockup.html`.
- Match AI Program's tool-page structure.
- Put the top workflow in one full-width `실행 단계` panel.
- Put selected-step controls in the lower panel.
- Do not duplicate the same preview/apply buttons in several places.
- Put 저장 and 불러오기 controls at the right side of the selected-step panel header.
- For detected-object workflows, show a real candidate review step. Do not reuse the input form as the candidate step.
- For file lists, `항목 추가` opens a file picker and stores selected paths as rows.
- For per-file preview summaries, use row badges such as count and number range.
- For bulk modify, delete, overwrite, or model-changing tools, show warning and confirmation states.

Ask:

```text
이 HTML 설정창 구성으로 진행할까요?
1. 그대로 진행 (추천)
2. 항목 추가
3. 항목 제거
4. 배치나 흐름 변경
```

## MD Authoring Rules

Read `references/ai-program-md-tool.md` before writing the final Markdown tool.

The final frontmatter should include, when relevant:

- `tool: true`
- `toolName`
- `version`
- `author`
- `description`
- `sectionId`
- `risk`
- `deterministic`
- `executionMode`
- `requiredServers`
- `mcpCommands`
- `preflightChecks`
- `settingsLayout`
- `executionSteps`
- `settings`
- `actions`
- `inputs`
- `outputs`
- `resultSchema`
- `failurePolicy`
- `testCases`
- `learningLog`

Use specific risk levels: `read`, `create`, `modify`, `bulk-modify`, `delete`, or `caution`.

For risky tools, prefer this action pattern:

1. `설정 입력`
2. `미리보기` or `분석`
3. `후보 확인` when detected candidates are needed
4. `실행` or `원본에 적용`

Use `미리보기` and `실행` as button labels unless the user's domain wording needs a clearer label.

## Program-Specific Checklist

### CAD

Ask for active DWG/file path, Model Space/Paper Space, selection scope, object types, layer/block/text/style criteria, coordinate basis, units, tolerance, output format, Undo/original preservation, and whether the original drawing changes.

For title-block or drawing-number tools, the preview step must return real detected block/title candidates from the drawing. Do not invent candidate names.

### Revit

Ask for Revit version, active model, current view, categories, families/types, levels, worksets, phases, design options, parameter names, transaction behavior, failure handling, changed element IDs, and export/log path.

### Excel

Ask for workbook/sheet/range source, header row, output sheet/file, overwrite behavior, formulas, formatting, and whether values or formulas are written.

### Tekla

Ask for model state, selection scope, object type, property names, numbering/export behavior, and rollback/logging.

### Custom Flow

Ask for input/output ports, expected node graph behavior, required tool nodes, grouping behavior, and saved flow metadata.

## Validation Checklist

Before finalizing:

- Every visible setting is meaningful.
- No select-like setting has only one option.
- Every setting id is unique.
- Every `executionSteps[].actionId` points to an existing action.
- Every `executionSteps[].section` points to an existing settings section.
- Every `mcpCommands[].params` setting reference points to an existing setting.
- Every MCP command server appears in `requiredServers`.
- Risky apply/run/save/delete actions require preview or confirmation.
- Executable tools have outputs and at least one test case.
- `learningLog` contains only safe analytics notes and no secrets.

## Learning Log Metadata

Add a compact `learningLog` block when the creation process reveals reusable improvement signals.

Capture:

- `observedFriction`: where the user hesitated, corrected the agent, or needed repeated clarification.
- `suggestedOptions`: option sets the agent proposed and which one was recommended.
- `selectedOptions`: what the user chose or rejected.
- `deferredImprovements`: safe future improvements.

Never store secrets, personal chat excerpts, file contents, tokens, or Codex thread identifiers in `learningLog`.

## Output

When the final tool is ready, report:

- The Markdown file path.
- The target program/menu.
- Whether MCP commands are `available`, `planned`, or `manual`.
- What still needs bridge verification.
