# AGENTS.md

## 작업 기준

- 이 저장소는 다른 컴퓨터와 GitHub로 동기화해서 사용한다.
- 작업 후 중요한 결정, 남은 일, 실행 방법은 `WORK_LOG.md`, `TODO.md`, `README_HANDOFF.md` 중 알맞은 파일에 기록한다.
- Codex 채팅 기록은 GitHub에 저장하지 않는다.

## 커밋 전 확인

커밋 전에는 반드시 다음을 확인한다.

```powershell
git status --short
pnpm test
pnpm typecheck
```

프로젝트 상황에 따라 `pnpm build`도 실행한다.

## 커밋 금지 항목

다음 항목은 Git에 넣지 않는다.

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

RVT, DWG, ZIP, 100MB 이상 파일이 보이면 바로 커밋하지 말고 사용자에게 포함 여부를 확인한다.
