---
name: save-tool
description: Create a local Markdown tool draft when the user types `/save <tool name>` or asks to save the current conversation/work as a reusable AI Program tool. Use this skill to turn the current Codex context into a `.md` tool file for later registration in AI Program Custom Tools or More Tools; do not upload to GitHub.
---

# Save Tool

## Purpose

Create a local `.md` tool draft from the current conversation or work context. This skill only writes a local draft file. GitHub upload happens later from AI Program's Custom Tools or More Tools registration flow.

## Workflow

1. Parse the requested tool name from `/save <tool name>`.
2. Summarize the current reusable workflow, decision rules, commands, file paths, caveats, and expected outputs.
3. Create a Markdown file using `scripts/create_tool_draft.py`.
4. Save it under the current project `tool-drafts/` directory unless the user gives another path.
5. Tell the user the created file path and that they can register it later from AI Program.

## Draft Content Rules

- Write the tool in Korean unless the user asked otherwise.
- Keep it reusable for another person, not just this one chat.
- Include concrete trigger examples, inputs, steps, validation, and warnings.
- Do not include private tokens, secrets, Codex chat IDs, or unrelated conversation text.
- Do not upload, commit, or publish the file.
- If the current context is too thin to make a useful tool, ask for the missing purpose or workflow before writing.

## Required Metadata

Every draft should include front matter:

```yaml
---
toolName: "Tool Name"
version: "1.0.0"
author: "Unknown"
description: "Short description"
sectionId: "servers"
createdAt: "ISO-8601 timestamp"
source: "codex-save-tool"
---
```

Use `sectionId: "servers"` for general tools unless the user clearly names a section such as `cad`, `revit`, `workflow`, `excel`, or `tekla`.

## Script

Use the bundled script whenever possible:

```powershell
python "$env:USERPROFILE\.codex\skills\save-tool\scripts\create_tool_draft.py" `
  --name "Tool Name" `
  --description "Short description" `
  --section-id "servers" `
  --body-file path\to\body.md `
  --output-dir tool-drafts
```

The script creates a safe filename, adds front matter, and refuses to overwrite an existing file unless `--overwrite` is passed.
