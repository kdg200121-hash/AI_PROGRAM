# AI Program MD Tool Template

Use this reference when generating a Markdown tool for AI_PROGRAM Custom Tools or More Tools.

## Frontmatter

```markdown
---
tool: true
name: Tool Name
program: CAD
version: 1.0.0
author: GitHub-or-nickname
description: One short sentence.
risk: safe
inputs:
  - type: file
    label: 작업 파일
outputs:
  - type: excel
    label: Excel
---
```

Use `risk: caution` when the tool can create, delete, move, overwrite, batch edit, export, or otherwise change user data.

## Body Template

```markdown
# Tool Name

## 목적

Explain what this tool does and when to use it.

## 작동 원리

### 1. 입력 수집

List the files, selected objects, ranges, layers, parameters, or user choices the tool needs.

### 2. MCP 명령 연결

Describe the MCP command or future MCP command that should receive the prepared input.

### 3. 결과 확인

Describe what the user should see after the command runs and what should be logged.

## 설정

| 필드 | 타입 | 필수 | 기본값 | 설명 |
| --- | --- | --- | --- | --- |
| 작업 대상 | text | yes |  | File, selected range, model, layer, or object group. |
| 실행 옵션 | text | no |  | Filters, matching rules, naming rules, or thresholds. |
| 메모 | textarea | no |  | User note shown before execution. |

## 입력 포트

- 필요한 입력값을 Custom Flow 노드 포트 기준으로 적습니다.
- 예: CAD 객체, Revit 요소, Excel, 숫자, 텍스트, 파일, 폴더.

## 출력 포트

- 다음 노드로 넘길 결과값을 적습니다.
- 예: Excel, CAD 객체 목록, Revit 요소 ID, 리포트, 로그.

## 실행 조건

- Required MCP server:
- Required program state:
- Required selection/file:

## 주의사항

- State destructive or broad changes clearly.
- If safe, write: "읽기 또는 정리 중심 작업이며 원본 데이터를 변경하지 않습니다."

## 예상 결과

- What is created, updated, returned, displayed, or saved.

## 실패 처리

- Missing selection:
- MCP disconnected:
- Invalid input:
```

## Settings Field Types

Prefer these simple field types:

- `text`: short user input
- `textarea`: notes, instructions, long filters
- `number`: count, distance, threshold
- `select`: one of several modes
- `checkbox`: yes/no option
- `file`: file path
- `folder`: folder path
- `object-selection`: current CAD/Revit/model selection
- `range-selection`: Excel or table range

## Program-Specific Hints

CAD:

- Ask about object type, layer, block name, coordinate basis, drawing unit, model/paper space.
- Caution if deleting, moving, exploding blocks, overwriting layers, or batch editing.

Revit:

- Ask about category, family/type, level, view, workset, parameters, selection scope.
- Caution if creating/deleting elements or changing parameters in bulk.

Custom Flow:

- Ask what nodes come before and after this tool.
- Ask which input and output ports are required.
- Ask whether the result should be passed to Excel, CAD, Revit, Tekla, or another custom tool.

Excel:

- Ask about sheet, range, headers, formulas, export path.
- Caution if overwriting cells, deleting rows, or changing formulas.

Tekla:

- Ask about model objects, phases, assemblies, numbering, report/export path.
- Caution if changing model objects or numbering.
