---
name: program-mcp-registrar
description: Use when the user types `/등록` or asks Codex to create, add, register, connect, scaffold, or verify a program MCP server for AI Program, including AutoCAD, Revit, Excel, Tekla, Dynamo, or another desktop program.
---

# Program MCP Registrar

Use this skill when the user wants AI Program to work with a desktop program through an MCP bridge.

Core order:

1. Check Codex Bridge setup first without printing a long process explanation.
2. If Codex Bridge is missing or failed, say briefly that it will be connected automatically, then try the saved command, local Codex runtime candidates, and the default `codex` command.
3. If Codex Bridge verifies, continue directly to program MCP selection or the user's already selected MCP.
4. If every automatic Codex Bridge attempt fails, stop before MCP connection and give only the concrete fix.

Do not claim a program MCP is ready just because registry values exist.

## Start Prompt

When the user types `/등록`, do not output the full flow. Run the Codex Bridge gate first. If it succeeds, ask only which program MCP to add unless the user already selected one.

```text
어떤 프로그램 MCP를 추가/확인할까요?
1. AutoCAD MCP - CAD 도면, 객체, 레이어, 블록 작업
2. Revit MCP - 모델 요소, 패밀리, 파라미터 작업
3. Excel MCP - 시트, 셀 범위, 리포트 작업
4. Tekla MCP - 구조 모델, 어셈블리, 리포트 작업
5. Dynamo MCP - Dynamo Player/그래프 실행
6. 기타 프로그램
```

If the user selects multiple numbers, handle them one by one after Codex Bridge readiness is confirmed.

## Required Codex Bridge Gate

Before creating, registering, starting, or testing any MCP bridge, check Codex Bridge readiness.

Check in this order:

1. App-side Codex Bridge feature:
   - Confirm the app exposes `Settings > Codex 연결`, or
   - Confirm the code/app has `codex-bridge:get-status`, `codex-bridge:save`, and `codex-bridge:test`.
2. Stored app settings:
   - Check `%APPDATA%\ai-program\codex-bridge.json`.
   - Report only command, working directory, sandbox, and last test status.
   - Do not print tokens, secrets, or session files.
3. Codex CLI availability:
   - If no stored command exists, use default command `codex`.
   - If `codex` is not found from the app process, try local Codex runtime candidates such as `~/.codex/plugins/.plugin-appserver/codex.exe` and `~/.codex/.sandbox-bin/codex.exe`.
   - Confirm `codex` or the configured command can run.
   - Prefer a safe read-only test: `codex exec --ephemeral --sandbox read-only "연결 테스트"`.
4. MCP availability in Codex:
   - Codex MCP servers are configured in `~/.codex/config.toml` or project `.codex/config.toml`.
   - Use `codex mcp --help` or `/mcp` in Codex TUI only as confirmation; do not assume MCP is configured from registry values alone.
   - If the selected AI Program MCP server is missing, add it with `codex mcp add <name> --url <url>` after confirming any write outside the workspace is approved.

If the saved command or default `codex` command cannot be verified, do not proceed to MCP connection unless the user explicitly asks to skip this setup.

## Automatic Codex Bridge Behavior

When `/등록` starts:

- Do not explain the workflow unless the user asks.
- If `%APPDATA%\ai-program\codex-bridge.json` is missing, stale, or failed, say: `Codex Bridge가 아직 확인되지 않아 자동 연결을 시도합니다.`
- Try candidates in this order:
  1. Saved command from `codex-bridge.json`
  2. `~/.codex/plugins/.plugin-appserver/codex.exe`
  3. `~/.codex/.sandbox-bin/codex.exe`
  4. `codex`
- Run the safe test with `exec --ephemeral --sandbox read-only`.
- If a candidate succeeds, save it to `%APPDATA%\ai-program\codex-bridge.json` with `lastTestStatus: ok`, then continue to MCP selection/registration.
- If all candidates fail, show only the failed command summary and the shortest concrete setup step. Do not print the long setup guide unless the user asks for details.

## Codex CLI MCP Registration

When the user wants `/등록` to make the MCP usable from Codex CLI too, check `codex mcp list`.

Use these global Codex MCP names for the default AI Program bridges:

| Program | Codex MCP name | URL |
|---|---|---|
| AutoCAD | `ai-program-cad` | `http://127.0.0.1:5100/mcp` |
| Revit | `ai-program-revit` | `http://127.0.0.1:5101/mcp` |
| Excel | `ai-program-excel` | `http://127.0.0.1:5200/mcp` |

If missing, add them with:

```powershell
codex mcp add ai-program-cad --url http://127.0.0.1:5100/mcp
codex mcp add ai-program-revit --url http://127.0.0.1:5101/mcp
codex mcp add ai-program-excel --url http://127.0.0.1:5200/mcp
```

Before editing `~/.codex/config.toml`, create a timestamped backup. After adding, verify with `codex mcp get <name>`.

## Codex Bridge Setup Guidance

When Codex Bridge is missing, show this guidance clearly:

```text
Codex Bridge 등록 방법

AI Program은 Codex CLI를 실행해서 Codex에게 MCP 작업을 맡길 수 있습니다.
먼저 이 컴퓨터에서 Codex CLI가 로그인되어 있고 실행 가능해야 합니다.

1. Codex CLI가 설치되어 있는지 확인
   - 터미널에서 `codex --version` 실행
2. Codex 로그인이 필요한 경우 Codex CLI 안내에 따라 로그인
3. AI Program 실행
4. Settings > Codex 연결 열기
5. Codex CLI 명령 입력
   - 보통 `codex`
   - 안 되면 `codex.cmd` 또는 전체 경로
6. 작업 폴더 입력
   - 비워두면 AI Program 실행 폴더 사용
   - 프로젝트 MCP 설정을 쓰려면 해당 프로젝트 폴더 입력
7. 실행 권한 선택
   - 기본: 읽기 전용
   - 파일 생성/수정이 필요하면 작업 폴더 쓰기 허용
8. 저장
9. 연결 테스트 실행

주의
- AI Program은 현재 열려 있는 Codex 채팅 세션을 직접 조작하지 않습니다.
- Codex Bridge는 별도 `codex exec` 프로세스를 실행합니다.
- Codex MCP 서버는 Codex 설정 파일에 등록되어 있어야 합니다.
```

Then end with:

```text
결과
- Codex Bridge: 미설정
- MCP 등록: 보류
- MCP 연결 확인: 보류

다음 작업
- AI Program > Settings > Codex 연결에서 Codex CLI를 저장하고 연결 테스트를 실행하세요.
- 테스트 성공 후 다시 /등록을 실행하면 MCP 연결 확인으로 이어서 진행합니다.
```

## Readiness Levels

Keep these states separate:

- Codex Bridge missing: no saved/default command can run Codex CLI.
- Codex Bridge configured: command exists, but safe `codex exec` test has not succeeded.
- Codex Bridge verified: command exists and safe `codex exec` test succeeded.
- Codex MCP configured: the relevant MCP server is present in Codex config.
- Registration prepared: server name, target, URL, port, launch command, working folder, and memo are prepared or saved.
- Bridge scaffolded: a bridge/add-in project exists, but real program control may still be missing.
- Program load unverified: the target program or add-in has not been confirmed.
- Connection verified: URL/port responds.
- Commands verified: MCP command list responds.
- Execution verified: one safe read-only program command succeeds.

If only a scaffold or placeholder bridge exists, say clearly that real program operation is not connected yet.

## Default MCP Candidates

These values are defaults, not proof that the bridge exists.

| Program | Target | Server name | URL | Port | Typical bridge |
|---|---|---|---|---:|---|
| AutoCAD | CAD | AutoCAD MCP Bridge | `http://localhost:5100/mcp` | 5100 | AutoCAD add-in, LISP wrapper, .NET/COM bridge |
| Revit | Revit | Revit MCP Bridge | `http://localhost:5101/mcp` | 5101 | Revit add-in or ExternalEvent bridge |
| Excel | Excel | Excel MCP Bridge | `http://localhost:5200/mcp` | 5200 | Office add-in, COM bridge, workbook automation bridge |
| Tekla | Tekla | Tekla MCP Bridge | `http://localhost:5300/mcp` | 5300 | Tekla Open API bridge |
| Dynamo | Revit | Dynamo MCP Bridge | `http://localhost:5400/mcp` | 5400 | Revit/Dynamo dependent bridge |

## MCP Questions

Ask these after Codex Bridge is configured or verified:

1. 브리지 또는 add-in이 이미 있나요?
   - 이미 있음
   - 일부만 있음
   - 없음, 만들어야 함
   - 모름
2. 이 컴퓨터에서 대상 프로그램을 바로 실행하거나 확인할 수 있나요?
   - 설치되어 있고 실행 가능
   - 설치되어 있지만 지금 실행하지 않음
   - 이 컴퓨터에 없음
   - 모름
3. 브리지를 어디에 만들거나 확인할까요?
   - 기존 경로
   - AI Program repo 안의 `tools/mcp-bridges/<program>`
   - 나중에 지정
4. 먼저 어디까지 할까요?
   - 등록값만 정리
   - 브리지 scaffold까지 생성
   - 등록 + 연결 확인까지 시도

If the user has already answered these, proceed with those answers instead of asking again.

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

For this AI Program app, Codex Bridge settings are expected to use:

- `Settings > Codex 연결`
- `%APPDATA%\ai-program\codex-bridge.json`
- `codex-bridge:get-status`
- `codex-bridge:save`
- `codex-bridge:test`

## Codex와 MCP 역할

Keep these two paths separate:

- AI Program 직접 실행: 앱 registry에 등록된 MCP 브리지로 명령을 보낸다.
- Codex CLI 실행: `~/.codex/config.toml`의 MCP 서버 설정을 기준으로 Codex가 MCP 서버에 접근한다.

`MCP 명령 목록`이 응답하기 전에는 MCP가 실제로 준비됐다고 말하지 않는다. CLI 설정, 앱 registry, 브리지 프로세스, 대상 프로그램 로드는 각각 따로 검증한다.

## Verification Procedure

Verify in this order:

1. Codex Bridge storage is checked.
2. If missing, guide Codex Bridge setup and stop.
3. If configured, run or read the Codex Bridge connection test.
4. Confirm the relevant MCP server is configured for Codex.
5. Target program is installed or available.
6. Target program is running if needed.
7. Add-in or bridge process is loaded.
8. URL/port responds.
9. MCP command list responds.
10. One safe read-only program command succeeds.

Safe MCP test commands:

- AutoCAD: get active document name, list layers, or read selected object count.
- Revit: get active document name, list categories, or read current selection count.
- Excel: get active workbook name, list sheets, or read used range summary.

If verification fails, explain likely causes: Codex CLI missing, Codex not logged in, Codex MCP server not configured, program closed, add-in not loaded, bridge process failed, port changed, firewall, health endpoint exists but MCP commands do not, or the tool command name does not exist in the bridge.

## Output Contract

End every run with:

```text
결과
- Codex Bridge:
- Codex MCP 설정:
- MCP 등록:
- 브리지 생성:
- 프로그램 로드:
- 연결 확인:
- 명령 확인:
- 테스트 실행:

Codex 연결
- 명령:
- 작업 폴더:
- 실행 권한:
- 확인 방법:
- 다음 조치:

다음 작업
- ...
```

Use conservative labels:

- 완료
- 준비 완료
- 확인 필요
- 실패
- 보류
- scaffold만 완료
- app 기능 미구현

## AI Program / Custom Flow Notes

When generating values for Custom Flow or MCP Tool Builder:

- Mark unverified command names as `planned`.
- Mark verified commands as `available`.
- Include required server names in tool schema.
- Include preflight checks for Codex Bridge readiness if the tool depends on Codex.
- Include preflight checks for program running, bridge connected, active document/workbook, and required selection.

## Do Not

- Do not claim the program is connected just because registry values exist.
- Do not continue MCP connection when Codex Bridge is missing unless the user explicitly asks to skip setup.
- Do not mark a placeholder bridge as executable.
- Do not invent SDK calls.
- Do not write outside the workspace without explicit approval.
- Do not store tokens, keys, sessions, or user-local runtime state in Git.
- Do not print, log, or summarize token/session values.
