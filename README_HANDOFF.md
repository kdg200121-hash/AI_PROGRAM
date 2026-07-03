# AI Program Handoff

작성일: 2026-07-03

## 프로젝트 위치

- A 컴퓨터 로컬 경로: `C:\Users\Donggeon\Documents\AI Program`
- Git 저장소 상태: GitHub 원격 저장소 연결 완료.
- 현재 브랜치: `codex/mcp-registry-desktop`

## 프로젝트 개요

AI Program은 `mcp-registry-desktop` 이름의 pnpm 기반 데스크톱 앱 프로젝트입니다. CAD/Revit MCP 연결 정보를 관리하는 Windows 데스크톱 앱으로 보입니다.

## 기본 실행

```powershell
pnpm install
pnpm dev
```

개발 서버 기본 주소는 다음입니다.

```text
http://127.0.0.1:5173/
```

## 확인 명령

```powershell
pnpm test
pnpm typecheck
pnpm build
```

## 다른 컴퓨터에서 이어받기

1. GitHub 저장소를 clone합니다.
2. clone 받은 폴더에서 `pnpm install`을 실행합니다.
3. 작업 전 `git pull`로 최신 상태를 받습니다.
4. 작업 후 `git status`, 테스트, commit, push를 진행합니다.

## Git에 넣지 않는 것

다음 항목은 내부 상태, 캐시, 설치 산출물 또는 민감 정보라서 Git에 포함하지 않습니다.

```text
.codex
.codex-runtime
sessions
state_5.sqlite
session_index.jsonl
node_modules
.pnpm-store
.venv
__pycache__
.cache
tmp
logs
.env
*.token
*.key
```

## 현재 주의점

- `README.md`는 UTF-8 기준 한글 문장으로 다시 정리했습니다.
- 앱 소스(`packages/desktop/src`)의 깨진 한글 UI 문자열은 복구했습니다. 남은 영어 고유명은 `CAD`, `Revit`, `MCP` 등 제품/기술 용어 위주입니다.
- `node_modules` 안에 100MB 이상 Electron 실행 파일이 있으나 Git 제외 대상입니다.
- Codex 채팅 기록은 GitHub로 넘어가지 않습니다. 중요한 내용은 `WORK_LOG.md`, `TODO.md`, `README_HANDOFF.md`에 남겨야 합니다.

