---
name: program-mcp-registrar
description: Use when the user types `/등록` or asks Codex to create, add, register, connect, scaffold, or verify a program MCP server for AI Program, including AutoCAD, Revit, Excel, Tekla, Dynamo, or another desktop program.
---

# Program MCP Registrar

Use this skill when the user wants AI Program to work with a desktop program through an MCP bridge. The goal is not only to write registration values, but to move as far as possible through bridge creation, app registration, connection, and verification.

## Core Rule

Do not claim a program MCP is ready just because registry values exist.

Use these levels separately:

- Registration prepared: server name, target, URL, port, launch command, working folder, and memo are prepared or saved.
- Bridge scaffolded: a bridge/add-in project exists, but real program control may still be missing.
- Program load unverified: the target program or add-in has not been confirmed.
- Connection verified: URL/port responds.
- Commands verified: MCP command list responds.
- Execution verified: one safe read-only command succeeds.

If only a scaffold exists, say clearly that real program operation is not connected yet.

## Start Prompt

When the user types `/등록`, ask which program MCP to add:

```text
어떤 프로그램 MCP를 추가할까요?
1. AutoCAD MCP - CAD 도면, 객체, 레이어, 블록 작업
2. Revit MCP - 모델 요소, 패밀리, 파라미터 작업
3. Excel MCP - 시트, 셀, 범위, 리포트 작업
4. Tekla MCP - 구조 모델, 어셈블리, 리포트 작업
5. Dynamo MCP - Dynamo Player/그래프 실행
6. 기타 프로그램
```

If the user selects multiple numbers, handle them one by one and summarize shared choices.

## Default Candidates

These values are defaults, not proof that the bridge exists.

| Program | Target | Server name | URL | Port | Typical bridge |
|---|---|---|---|---:|---|
| AutoCAD | CAD | AutoCAD MCP Bridge | `http://localhost:5100/mcp` | 5100 | AutoCAD add-in, LISP wrapper, .NET/COM bridge |
| Revit | Revit | Revit MCP Bridge | `http://localhost:5001/mcp` | 5001 | Revit add-in or ExternalEvent bridge |
| Excel | Excel | Excel MCP Bridge | `http://localhost:5200/mcp` | 5200 | Office add-in, COM bridge, workbook automation bridge |
| Tekla | Tekla | Tekla MCP Bridge | `http://localhost:5300/mcp` | 5300 | Tekla Open API bridge |
| Dynamo | Revit | Dynamo MCP Bridge | `http://localhost:5400/mcp` | 5400 | Revit/Dynamo dependent bridge |

## Required Questions

Ask concise Korean questions before making files or changing registry state:

1. 브리지나 애드인이 이미 있나요?
   - 이미 있음
   - 일부만 있음
   - 아직 없음, 만들어야 함
2. 이 컴퓨터에서 대상 프로그램을 바로 실행하거나 확인할 수 있나요?
   - 설치되어 있고 실행 가능
   - 설치되어 있지만 지금 실행하지 않음
   - 이 컴퓨터에는 없음
3. 브리지를 어디에 만들거나 둘까요?
   - 기존 경로
   - AI Program repo 안의 `tools/mcp-bridges/<program>`
   - 나중에 지정
4. 먼저 등록만 할까요, 아니면 스캐폴드 생성까지 할까요?

## Bridge Creation Rules

When no bridge exists and the user asks Codex to make one:

- Inspect the current repo first.
- Prefer existing project conventions and package scripts.
- Create scaffold files only inside the workspace unless the user explicitly approves another path.
- Include health/status and command-list endpoints if possible.
- Mark commands as `planned` until real SDK/API calls exist.
- Never fake SDK success.

Use the proper future integration layer:

- AutoCAD: AutoCAD .NET API, COM, LISP wrapper, or loaded add-in bridge.
- Revit: Revit add-in plus ExternalEvent or another valid Revit API bridge.
- Excel: Office add-in, COM, Graph, or local workbook bridge.
- Tekla: Tekla Open API.
- Dynamo: Dynamo/Revit-hosted command path.

If the SDK or target program is unavailable, create only the scaffold and list the missing real connection work.

## AI Program Registration Rules

Prefer registering through AI Program Settings or the app registry IPC/API when available. If editing files directly:

- Confirm registry path and schema from the current codebase.
- Do not write to random user-data paths without checking the app code.
- Keep missing bridges disconnected.
- Do not mark a server running unless it actually responds.

## OpenAI API Key Setup

When the user wants AI Program to execute tool actions through OpenAI, guide them to configure the key inside the app instead of pasting secrets into chat:

1. Open AI Program.
2. Go to `Settings > AI 연결`.
3. Enter the OpenAI API key and model, then click 저장.
4. Verify the status says 연결 준비됨.

The app stores the key in the local user data folder with Electron safe storage. Environment variables remain valid fallbacks: `AI_PROGRAM_OPENAI_API_KEY`, `OPENAI_API_KEY`, and `AI_PROGRAM_OPENAI_MODEL`.

API 키를 채팅, 로그, GitHub, 툴 MD 파일에 기록하지 않는다. If the user shares a key by mistake, tell them to revoke it and create a new key.

When finishing `/등록`, include the AI connection state separately from MCP bridge state:

```text
AI 연결
- API 키: 앱 저장 / 환경 변수 / 미설정
- 모델:
- 다음 조치:
```

Use this registration summary:

```text
AI Program MCP 등록값
- 서버 이름:
- 대상:
- 연결 URL:
- 포트:
- 실행 명령:
- 작업 폴더:
- 상태:
- 메모:
```

## Verification Procedure

After registration, verify in this order:

1. Target program is installed or available.
2. Target program is running if needed.
3. Add-in or bridge process is loaded.
4. URL/port responds.
5. MCP command list responds.
6. One safe read-only command succeeds.

Safe test commands:

- AutoCAD: get active document name, list layers, or read selected object count.
- Revit: get active document name, list categories, or read current selection count.
- Excel: get active workbook name, list sheets, or read used range summary.

If verification fails, explain likely causes: program closed, add-in not loaded, bridge process failed, port changed, firewall, health endpoint exists but MCP commands do not, or the tool MD command name does not exist in the bridge.

## Output Contract

End every run with:

```text
결과
- 등록:
- 브리지 생성:
- 프로그램 로드:
- 연결 확인:
- 명령 확인:
- 테스트 실행:

다음 작업
- ...
```

Use conservative labels:

- 완료
- 준비 완료
- 확인 전
- 실패
- 스캐폴드만 완료

## AI Program / Custom Flow Notes

When generating values for Custom Flow or MCP Tool Builder:

- Mark unverified command names as `planned`.
- Mark verified commands as `available`.
- Include required server names in tool schema.
- Include preflight checks for program running, bridge connected, active document/workbook, and required selection.

## Do Not

- Do not claim the program is connected just because registry values exist.
- Do not mark a placeholder bridge as executable.
- Do not invent SDK calls.
- Do not write outside the workspace without explicit approval.
- Do not store tokens, keys, sessions, or user-local runtime state in Git.
