---
name: program-mcp-registrar
description: Use when the user types `/등록` or asks to add, register, connect, or verify a program MCP server for AI Program, including AutoCAD, Revit, Excel, Tekla, Dynamo, or another desktop program.
---

# Program MCP Registrar

Use this skill to help a non-technical user register a program-specific MCP server in AI Program and verify whether future MCP tools can actually run.

## Command Trigger

When the user types `/등록`, first show a program selection list. Do not assume the program silently.

Recommended first response:

```text
어떤 프로그램 MCP를 추가할까요?
1. AutoCAD MCP (추천: CAD 도면/객체 작업)
2. Revit MCP (추천: 모델 요소 생성/수정)
3. Excel MCP (추천: 표 읽기/쓰기)
4. Tekla MCP (추천: 구조 모델 작업)
5. Dynamo MCP (추천: Dynamo Player/그래프 실행)
6. 기타 프로그램
```

If the user already named a program, continue with that program and still confirm the detected choice briefly.

## Core Rule

Registration is not the same as successful execution. Always separate these two states:

- **등록 준비 완료**: AI Program에 넣을 서버 이름, 대상 프로그램, URL, 포트, 실행 명령이 정리됨.
- **연결 확인 완료**: 해당 URL/포트에 MCP 서버가 응답함.
- **실행 확인 완료**: 명령 목록 조회와 테스트 명령 1개 실행이 성공함.

Never tell the user that future MCP tools will run without checking the bridge/server and at least one test command.

## Program Defaults

Use these as starting candidates, not guaranteed facts:

| Program | Target | Default server name | URL example | Port | Bridge note |
|---|---|---|---|---:|---|
| AutoCAD | CAD | AutoCAD MCP Bridge | `http://localhost:5100/mcp` | 5100 | AutoCAD add-in or external bridge must be running |
| Revit | Revit | Revit MCP Bridge | `http://localhost:5001/mcp` | 5001 | Revit add-in/bridge must be loaded in Revit |
| Excel | Excel | Excel MCP Bridge | `http://localhost:5200/mcp` | 5200 | Excel bridge must expose workbook commands |
| Tekla | Tekla | Tekla MCP Bridge | `http://localhost:5300/mcp` | 5300 | Tekla bridge must expose model commands |
| Dynamo | Revit | Dynamo MCP Bridge | `http://localhost:5400/mcp` | 5400 | Usually depends on Revit/Dynamo environment |

For unknown programs, ask for the program name, expected command target, port or URL if known, and how the bridge is started.

## Registration Questions

Ask Korean, choice-based questions whenever possible.

Required information:

- Program: AutoCAD, Revit, Excel, Tekla, Dynamo, or other.
- Server display name.
- Target type in AI Program: `CAD`, `Revit`, `Excel`, `Tekla`, `Custom`, or `Other`.
- URL and port.
- Start method: already running, executable path, add-in loaded by the program, or unknown.
- Working folder if an executable bridge is used.
- Memo: what this bridge will be used for.

If any required value is unknown, propose a default and ask for approval instead of inventing it silently.

## Output Contract

After collecting the values, show a registration block the user can apply in AI Program:

```text
AI Program MCP 등록값
- 서버 이름:
- 대상:
- 연결 URL:
- 포트:
- 실행 명령:
- 작업 폴더:
- 메모:
```

Then show the verification plan:

```text
연결 확인 순서
1. 대상 프로그램 실행 확인
2. MCP 브리지 실행/로드 확인
3. URL/포트 응답 확인
4. MCP 명령 목록 조회
5. 안전한 테스트 명령 1개 실행
```

## Verification Guidance

If the user asks whether it will run later, answer conservatively:

- If only registration values are prepared, say "등록 준비 단계입니다."
- If URL/port responds, say "연결 확인 단계까지 됐습니다."
- If command list and test command pass, say "실행 확인 단계까지 됐습니다."

When verification fails, explain likely causes in simple Korean:

- Program is closed.
- MCP bridge/add-in is not loaded.
- Port is different.
- Firewall or permission issue.
- The tool MD command name does not exist in the bridge.
- The bridge supports connection but not the requested command yet.

## AI Program Integration Notes

Prefer adding the MCP server through AI Program Settings > MCP 서버. If a future app API exists for direct registry writes, use it only after confirming the exact target file and schema from the current codebase.

When generating values for Custom Flow or MCP Tool Builder, keep command names marked as `planned` unless the bridge command list was actually checked.

