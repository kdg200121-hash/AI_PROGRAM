---
name: save-tool
description: Use when the user types `/save` or asks to save the current conversation/work as a reusable AI Program Markdown tool draft; guide the user with Korean questions for tool name, settings, inputs, outputs, risks, and execution details before writing a local `.md` file.
---

# Save Tool

Use this skill to turn the current conversation or work context into a local AI Program `.md` tool draft. This skill only creates a local draft file. GitHub upload or app registration happens later from AI Program.

## Command Trigger

Only `/save` is supported.

If the user writes `/save` with extra words after it, do not treat those words as a confirmed tool name. Use them only as hints, then inspect the conversation and propose 2-4 Korean tool-name candidates with one recommended option.

Do not silently invent a final name. If the conversation is too broad or unclear, ask what should be saved and offer practical choices.

## Core Rule

Do not blindly summarize the chat. A saved tool must be reusable by someone else.

Before writing the file, confirm the reusable tool specification in Korean. If required settings, inputs, outputs, risk behavior, MCP server, or execution rules are missing, ask follow-up questions. For non-technical users, propose choices instead of asking broad technical questions.

If you ask about multiple missing items and the user answers only part of them, do not assume the unanswered part. Restate the missing item and offer 2-4 choices with one recommended option.

## Required Minimum Information

Collect or confirm:

- Tool display name in Korean.
- Target menu/program: CAD, Revit, Custom Flow, Excel, Tekla, More Tools, or servers/general.
- Purpose and one-sentence reusable workflow.
- Input source: file, selected objects, active program, current model, current sheet, text, or none.
- Output/result: text, file, CAD objects, Revit elements, Excel range, JSON, log, or none.
- Risk level: read-only, file creation, model/file modification, bulk modification, overwrite, delete.
- Required MCP server or planned server.
- At least one preflight check.
- Failure behavior: stop, partial success report, rollback, or log only.

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
- MCP server and command plan. Mark unavailable commands as `planned`.
- Outputs, result schema, logs, and Custom Flow ports if relevant.
- Risk level, overwrite/backup behavior, preflight checks, failure policy, and rollback/logging behavior.
- At least one concrete test case with expected result.

Ask:

```text
이 전체 툴 사양으로 저장할까요?
1. 그대로 진행 (추천)
2. 항목 추가
3. 항목 제거
4. 순서나 방식 변경
```

Do not create the draft file until the user approves.

## HTML Settings Mockup

After the full tool specification is approved, create a realistic HTML settings-window mockup before writing the final draft.

Requirements:

- Save under `outputs/<safe-tool-name>-settings-mockup.html`.
- Use the AI Program tool page structure: top full-width `작동 원리`, lower large `설정` panel.
- Put all custom settings inside the lower `설정` panel.
- Show actual fields, buttons, warnings, preview/result areas, disabled/enabled states, and list controls if needed.
- For file-list settings, `항목 추가` must open a file picker and store selected file paths as list item values. Use `type: repeatable-list`, `itemType: file`, `valueKey: file_path`, and an `accept` filter such as `.dwg,.dxf` when the list is a set of files.
- When a file-list tool can calculate per-file preview results, add row summary metadata such as `showItemSummary: true`, `summaryCountKey: title_block_count`, `summaryRangeKey: number_range`, `pendingSummaryLabel`, and `pendingRangeLabel`. Show these badges in the HTML mockup beside each file row, not as a separate long table.
- Keep dense review-only information compact. Put execution summary, preflight checks, validation, and test summary behind one compact review/icon area, and expand each detail only when the user clicks its icon.
- For destructive or bulk-edit tools, show a visible warning and final confirmation area.
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
- Do not use an English filename or slug as the visible tool name.
- Automatically generate a short Korean `description` if the user did not provide one.
- Include settings layout, MCP command plan, preflight checks, result schema, risk level, failure policy, and test cases when possible.
- Mark non-existing MCP commands as `planned` and say they still require bridge implementation/verification.
- Do not include private tokens, secrets, Codex chat IDs, or unrelated conversation text.
- Do not upload, commit, or publish the draft.

## Required Frontmatter Shape

```yaml
---
tool: true
toolName: "승인된 한글 툴 이름"
version: "1.0.0"
author: "Unknown"
description: "대상과 동작과 결과를 설명하는 한글 한 문장"
sectionId: "servers"
createdAt: "ISO-8601 timestamp"
source: "codex-save-tool"
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
testCases: []
settings: []
inputs: []
outputs: []
---
```

## Script

Use the bundled script whenever possible:

```powershell
python "$env:USERPROFILE\.codex\skills\save-tool\scripts\create_tool_draft.py" `
  --name "승인된 한글 툴 이름" `
  --description "대상과 동작과 결과를 설명하는 한글 한 문장" `
  --section-id "servers" `
  --body-file path\to\body.md `
  --output-dir tool-drafts
```
