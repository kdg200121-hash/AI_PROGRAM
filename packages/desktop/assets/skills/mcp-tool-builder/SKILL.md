---
name: mcp-tool-builder
description: Create or refine AI Program MCP tool Markdown files for Custom Tools or More Tools. Use when the user wants to design an MCP/MD tool, prepare a reusable tool for AI_PROGRAM, define the tool's operation flow, customize the settings panel fields, or be guided with questions before writing a `.md` tool file.
---

# MCP Tool Builder

Use this skill when a user wants to turn an idea into an AI Program-compatible MCP tool Markdown file.

## Workflow

1. Ask which program the tool targets: CAD, Revit, Custom Flow, Excel, Tekla, or Other.
2. Ask what the tool does in one sentence.
3. Ask what input the user must provide before execution.
4. Ask what the tool should return, display, save, or pass to the next node.
5. Ask whether the tool changes data. If it creates, deletes, moves, renames, overwrites, exports, batch edits, or runs broad model/document changes, mark the tool as requiring caution.
6. Define the tool page:
   - Tool name
   - Short description
   - Author
   - Version
   - Operation flow for the `작동 원리` panel
   - Settings fields for the `설정` panel
   - Expected output/result section
7. Write the Markdown file with YAML frontmatter and clear sections.
8. Before finalizing, check that the tool can be understood by someone who did not see the chat.

## Required Questions

Ask these in Korean unless the user requests another language:

- 어느 프로그램에서 쓰는 TOOL인가요? CAD, Revit, 커스텀 플로우, Excel, Tekla, Other 중에서 골라주세요.
- 이 TOOL은 한 문장으로 무엇을 하나요?
- 실행 전에 사용자가 선택하거나 입력해야 하는 값은 무엇인가요?
- 실행 결과는 어디에 표시되거나 저장되어야 하나요?
- 다른 TOOL이나 노드로 넘겨야 하는 결과값이 있나요? 예: Excel, CAD 객체, Revit 요소, 숫자, 텍스트.
- 객체나 파일을 생성, 삭제, 이동, 이름 변경, 덮어쓰기, 일괄 수정하나요?
- 실패했을 때 사용자에게 어떤 확인 메시지를 보여줘야 하나요?

## Markdown Structure

Use `references/ai-program-md-tool.md` when writing the final `.md` file.

Keep the generated tool practical:

- Put the important behavior in `## 목적`.
- Put page layout content in `## 작동 원리` and `## 설정`.
- Use field names that can become UI labels.
- Include input/output ports when the tool will be used in Custom Flow.
- Include caution notes when the tool can modify or delete data.
- Do not invent API calls that do not exist. If execution depends on a future MCP command, state it as a required MCP command.

## Output

When the user asks to create the file, create a `.md` file named from the tool name in hyphen-case or snake_case, according to the current project's convention. If no project convention is visible, use hyphen-case.
