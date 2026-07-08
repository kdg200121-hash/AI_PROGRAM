---
name: save-tool
description: Use when the user types `/save` or asks to save current work as a reusable AI Program Markdown tool draft.
---

# Save Tool

Use this skill to turn the current conversation or work context into a local AI Program Markdown tool draft.

This skill only creates a local draft file. Do not upload, publish, commit, or register the tool automatically. GitHub upload or AI Program registration happens later from the app.

## Command Trigger

Only `/save` is supported.

If the user writes `/save <words>`, treat the extra words as hints, not as a confirmed final tool name. Inspect the conversation and propose 2-4 Korean tool-name candidates with one recommended option.

Do not silently invent a final name. If the conversation is too broad or unclear, ask what should be saved and offer practical choices.

## Core Rule

Do not blindly summarize the chat. A saved tool must be reusable by someone else.

Before writing the file, confirm the reusable tool specification in Korean. If required settings, inputs, outputs, risk behavior, MCP server, or execution rules are missing, ask follow-up questions.

For non-technical users, use choice-based questions. Ask like 스무고개처럼 until the behavior is clear.

Visible `settings` are only for values the user should choose. Fixed constants, single-option values, derived preview values, and clicked-button states do not become settings.

For preview/apply workflows, use `actions` and `executionSteps`. Do not create a `dry-run` setting unless the final tool truly needs one execution button with a user-selectable preview-only mode.

## Required Minimum Information

Collect or confirm:

- Korean display name.
- Target menu/program: CAD, Revit, Custom Flow, Excel, Tekla, Market, or Other.
- Purpose and reusable workflow.
- Input source: file, selected objects, active program, current model, current sheet, text, previous node output, or none.
- Output/result: text, file, CAD objects, Revit elements, Excel range, JSON, log, or none.
- Risk level: read, create, modify, bulk-modify, delete, or caution.
- Required MCP server or planned server.
- At least one preflight check.
- Failure behavior: stop, partial success report, rollback, backup, or log only.

## Workflow

1. Inspect the current conversation and identify candidate reusable tool ideas.
2. Propose 2-4 Korean tool names and mark one as recommended.
3. Ask the user to choose or approve a name.
4. Extract the full tool specification: target program, settings, inputs, outputs, MCP command plan, risk, preflight checks, and test cases.
5. Show the full specification in Korean and ask for approval.
6. Create an HTML settings-window mockup under `outputs/<safe-tool-name>-settings-mockup.html`.
7. Ask the user to approve the mockup before writing the final draft.
8. Write the Markdown body in Korean.
9. Use `scripts/create_tool_draft.py` to create the final draft under `tool-drafts/` unless the user gives another path.
10. Report the created file path and remind the user it can be registered later from AI Program.

## Full Tool Spec Confirmation

Before writing the draft, show:

- Tool name and target menu/program.
- Display metadata: Korean `toolName`, safe filename/id, and Korean `description`.
- Purpose and reusable workflow.
- Input source, selections/files, and scope.
- Settings sections and fields, including defaults and required values.
- Execution steps for the tool page. Each step must have `id`, `label`, `description`, and when relevant `section` or `actionId`.
- Fixed constants, single-option values, derived preview badges, and runtime actions separately from editable settings.
- UI pattern: simple/sectioned for read or export, workflow actions for analyze-then-modify CAD/Revit tools.
- MCP server and command plan. Mark unavailable commands as `planned`.
- Outputs, result schema, logs, and Custom Flow ports if relevant.
- Risk level, overwrite/backup behavior, preflight checks, failure policy, and rollback/logging behavior.
- At least one concrete test case with expected result.
- `learningLog` notes if the chat revealed repeated friction, corrections, or useful choice patterns.

Ask:

```text
이 전체 도구 사양으로 저장할까요?
1. 그대로 진행 (추천)
2. 항목 추가
3. 항목 제거
4. 순서나 방식 변경
```

Do not create the draft file until the user approves.

## HTML Settings Mockup

After the full specification is approved, create a realistic HTML settings-window mockup before writing the final draft.

Requirements:

- Save under `outputs/<safe-tool-name>-settings-mockup.html`.
- Use the AI Program tool page structure: top full-width `실행 단계`, lower selected-step panel.
- Show actual fields, buttons, warnings, preview/result areas, disabled/enabled states, and list controls.
- Put operation-principle explanation inside each step description. Do not create a separate old-style `작동 원리` panel.
- Put preset/profile controls such as 저장 and 불러오기 in the selected-step panel header on the far right.
- For file-list settings, `항목 추가` opens a file picker and stores selected file paths.
- For detected candidates, show a candidate review/selection view, not another copy of the input form.
- For risky tools, show preview before apply and make apply disabled until preview succeeds.
- Keep the mockup self-contained with inline CSS.

Ask:

```text
이 HTML 설정창 구성으로 저장할까요?
1. 그대로 저장 (추천)
2. 항목 추가
3. 항목 제거
4. 배치나 이름 변경
```

## Draft Rules

- Write in Korean unless the user asks otherwise.
- Use the approved Korean tool name exactly in frontmatter `toolName` and the first Markdown heading.
- Automatically generate a short Korean `description` if the user did not provide one.
- Include settings layout, executionSteps, MCP command plan, preflight checks, result schema, risk level, failure policy, and test cases when possible.
- Before writing final frontmatter, audit every `settings` item and remove fixed constants, single-option select-like values, generated preview summaries, or runtime button states.
- Mark non-existing MCP commands as `planned` and say they still require bridge implementation/verification.
- Add `learningLog` metadata when the conversation reveals reusable skill-improvement signals.
- Do not include private tokens, secrets, Codex chat IDs, or unrelated conversation text.
- Do not upload, commit, publish, or register the draft.

## Required Frontmatter Shape

```yaml
---
tool: true
toolName: "승인된 한국어 도구 이름"
version: "1.0.0"
author: "Unknown"
description: "대상과 동작과 결과를 설명하는 짧은 한 문장"
sectionId: "cad"
risk: "read"
deterministic: true
executionMode: "manual"
requiredServers: []
mcpCommands: []
preflightChecks: []
resultSchema:
  type: "text"
  fields: []
failurePolicy:
  partialSuccess: "report"
  rollback: "none"
  log: true
settingsLayout:
  mode: "simple"
  sections: []
executionSteps: []
testCases: []
settings: []
actions: []
inputs: []
outputs: []
learningLog:
  schemaVersion: "1"
  sourceSkill: "save-tool"
  observedFriction: []
  suggestedOptions: []
  selectedOptions: []
  deferredImprovements: []
---
```

## Learning Log Metadata

Use `learningLog` to capture patterns that can improve `/save`, `/make`, and AI Program tool creation later without affecting tool execution.

- `observedFriction`: where the user got stuck, corrected the agent, or needed repeated clarification.
- `suggestedOptions`: option sets the agent offered, including the recommended option.
- `selectedOptions`: options the user chose, changed, or rejected.
- `deferredImprovements`: improvements worth reviewing in a later skill upgrade.

Never store secrets, personal chat excerpts, file contents, or personal data. Keep entries short and anonymized.

## Script

Use the bundled script whenever possible:

```powershell
python "$env:USERPROFILE\.codex\skills\save-tool\scripts\create_tool_draft.py" `
  --name "승인된 한국어 도구 이름" `
  --description "대상과 동작과 결과를 설명하는 짧은 한 문장" `
  --section-id "cad" `
  --body-file path\to\body.md `
  --frontmatter-file path\to\approved-frontmatter.yml `
  --output-dir tool-drafts
```

If there is no approved frontmatter yet, omit `--frontmatter-file`; the script will create a safe minimal draft. For executable or settings-rich tools, create and pass approved frontmatter instead of relying on the minimal default.
