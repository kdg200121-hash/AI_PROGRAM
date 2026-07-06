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

`pnpm dev`는 Vite 개발 서버를 내부에서 띄운 뒤 Electron 데스크톱 프로그램 창을 실행합니다. 웹 브라우저 미리보기만 필요할 때는 다음 명령을 사용합니다.

```powershell
pnpm dev:web
```

## 확인 명령

```powershell
pnpm test
pnpm typecheck
pnpm build
```

## Windows exe 패키징

```powershell
pnpm package:win
```

생성물은 `release\AI_PROGRAM-win32-x64\AI_PROGRAM.exe`입니다. 다른 사람에게 전달할 때는 exe 단일 파일이 아니라 `AI_PROGRAM-win32-x64` 폴더 전체를 전달합니다.

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
- 설정 창의 MCP 서버 목록은 이제 `data/registry.json`을 Electron IPC로 읽고 쓰며, 앱에서 서버 추가/수정/삭제가 가능합니다.
- 우측 상단 `MCP 연결상태` 버튼과 설정 창의 `자동 추가`는 같은 로컬 MCP 서버 자동 감지 로직을 사용합니다.
- 우측 상단 MCP 연결 상태 배지는 현재 열린 페이지의 프로그램 기준으로 표시합니다. CAD 페이지는 CAD MCP, Revit 페이지는 Revit MCP, Revit-CAD 흐름 페이지는 CAD/Revit MCP 상태를 봅니다.
- 좌측 메뉴는 `CAD`, `Revit`, `Revit <> CAD`, `Excel`, `Tekla` 순서이며, 메뉴 본문은 MCP 툴 정리 페이지 기준입니다.
- 메인페이지는 메뉴별로 Share Tools / Custom Tools 카드 구조를 공통으로 사용합니다.
- 아이콘은 `packages/desktop/src/uiIcons.tsx`의 `AppIcon` 컴포넌트를 우선 사용합니다. 새 메뉴/버튼/카드 헤더 아이콘을 추가할 때 CSS pseudo-element로 새로 그리지 말고 `AppIconName`에 이름을 추가하는 방식으로 통일합니다.
- 반복되는 카드/패널 상단 제목 영역은 `packages/desktop/src/panelHeader.tsx`의 `PanelHeader`를 우선 사용합니다.
- 메인페이지 툴 카드에는 `등록됨`, `공유`, `MCP 미연결` 같은 상태 뱃지를 표시하지 않습니다. 현재 메뉴에 필요한 MCP 서버가 running 상태가 아니면 툴 카드는 회색 비활성 상태가 되고 hover 문구로 이유를 보여줍니다.
- MD 파일이 툴 문서 형태로 보이지 않으면 등록은 허용하되, 등록 폼에 경고를 표시하고 메인페이지 카드 배경을 경고색으로 구분합니다. 해당 툴을 실행할 때도 확인창을 한 번 띄웁니다.
- MD 파일 내용에서 객체/요소 삭제 또는 생성 후보 동작이 감지되면 Custom Tools / More Tools 리스트의 툴 이름 옆에 `주의` 배지가 표시됩니다. 배지를 클릭하면 감지 이유가 펼쳐지고, 메인페이지에서 실행할 때도 확인창이 표시됩니다.
- 소메뉴는 `Share Tools`, `Custom Tools` 분류명이 아니라 실제 툴 이름을 표시합니다. 소메뉴명과 설명은 소메뉴 페이지에서 바로 수정 가능하며 localStorage에 저장됩니다.
- Custom Tools 창은 메뉴별 커스텀 툴과 전체 More Tools를 모두 지원합니다.
- Custom Tools / More Tools 창에는 별도 GitHub 버튼을 표시하지 않습니다.
- Custom Tools / More Tools 창을 열면 GitHub 저장소 `kdg200121-hash/AI_PROGRAM`의 `tools/` 폴더에서 `.md/.markdown` 툴 목록을 자동으로 읽어옵니다.
- GitHub에서 가져온 툴은 MD frontmatter의 `author`를 우선 사용하고, 없으면 저장소 owner인 `kdg200121-hash`를 제작자로 표시합니다.
- `tools/` 폴더에 아직 MD 툴이 없으면 창 상단에 등록된 MD 툴이 없다는 상태 메시지만 표시됩니다.
- 기존 localStorage에 남아 있던 로컬 MD 동기화 툴은 더 이상 목록에 표시하지 않습니다. `sourcePath` 또는 `installedPath`가 `github:kdg200121-hash/AI_PROGRAM/tools/`로 시작하는 항목만 로드합니다.
- 좌측 상단 브랜드 영역의 버전 줄에는 로그인 버튼이 있습니다. 로그인 전에는 `로그인`, 로그인 후에는 `닉네임님`으로 표시됩니다.
- 로그인은 GitHub OAuth Device Flow 기반입니다. GitHub 로그인 시작 시 브라우저가 열리고 앱에는 user code와 `인증 완료 확인` 버튼이 표시됩니다.
- GitHub OAuth scope는 `read:user public_repo`입니다. 기존 로그인 토큰에 `public_repo` 권한이 없으면 툴 등록 PR 생성이 실패할 수 있으므로 로그아웃 후 다시 로그인해야 합니다.
- GitHub OAuth App Client ID는 `data/github-oauth.json`에 들어 있으며 패키징된 앱에 포함됩니다. 일반 사용자는 별도 환경 변수를 설정하지 않아도 됩니다.
- 개발 중 다른 OAuth App을 쓰고 싶으면 실행 환경에 `AI_PROGRAM_GITHUB_CLIENT_ID` 또는 `VITE_GITHUB_CLIENT_ID`를 설정해 bundled 값을 덮어쓸 수 있습니다.
- GitHub access token은 renderer localStorage가 아니라 Electron 사용자 데이터 폴더의 `github-auth.json`에 저장합니다. Electron `safeStorage`를 사용할 수 있으면 `safe:` prefix로 암호화해 저장하고, renderer에는 GitHub ID/닉네임/아바타 URL만 노출합니다.
- 같은 GitHub 계정으로 다시 인증할 때 닉네임 입력이 비어 있으면 GitHub 이름으로 덮지 않고 기존 저장 닉네임을 유지합니다. 사용자가 회원정보에서 새 닉네임을 저장하거나 재인증 화면에서 새 닉네임을 입력한 경우에만 닉네임이 바뀝니다.
- `github-auth.json`은 Electron 사용자 데이터 폴더에 남기 때문에 로그아웃하지 않는 한 앱 재시작이나 PC 재부팅 후에도 로그인 상태가 유지됩니다. GitHub 토큰이 사용자가 직접 취소되거나 파일이 삭제되면 다시 인증해야 합니다.
- 툴 등록 신규 폼의 제작자 기본값은 로그인 닉네임을 우선 사용하고, 로그인 전에는 `kdg200121-hash`를 사용합니다.
- Settings에는 `계정 정보`와 `관리` 섹션이 있습니다.
- `관리` 섹션은 GitHub ID가 `kdg200121-hash`인 계정에서만 활성화됩니다.
- 관리 화면에서는 회원가입 방식을 `자유 가입`/`승인제`로 고르고, 라이선스 정책을 `모두 사용`/`라이선스만`으로 고를 수 있습니다.
- 관리 화면에서는 커스텀 툴 등록 방식을 `자유 등록`/`승인제`로 고를 수 있습니다.
- 관리 화면의 회원 목록에서는 승인 대기 계정 승인, 라이선스 활성화/비활성화, 일반 계정 삭제를 할 수 있습니다. 관리자 계정은 삭제하거나 라이선스를 비활성화할 수 없습니다.
- 관리 화면의 회원 목록에는 가입일이 표시되며, 계정/닉네임/상태/라이선스/가입일 타이틀을 클릭해 내림차순/오름차순/기본 순서로 정렬할 수 있습니다.
- 회원가입 승인제에서 승인 대기 계정은 `Settings > 관리 > 회원 목록`에 표시됩니다.
- 툴 등록 승인제에서 일반 사용자가 추가한 커스텀 툴은 `승인 대기` 배지와 함께 Custom Tools / More Tools 목록에 표시되고, 관리자 승인 후 등록/해제 버튼을 사용할 수 있습니다.
- 현재 계정 정책과 회원 목록은 앱 localStorage 기반입니다. 다른 컴퓨터까지 중앙에서 강제하려면 GitHub 저장소 또는 별도 서버에 정책/회원 목록을 동기화하는 후속 구현이 필요합니다.
- Home의 `Other Tools` 카드는 `채팅을 TOOL로 저장` 안내와 다운로드 아이콘 버튼을 표시합니다. 버튼을 누르면 앱에 포함된 `save-tool` Codex 스킬이 현재 사용자 `~/.codex/skills/save-tool`에 설치되어, `/SAVE 툴이름` 명령으로 해당 채팅을 로컬 MD TOOL 초안으로 저장할 수 있습니다.
- `save-tool` 설치 원본은 `packages/desktop/assets/skills/save-tool`에 있으며, Windows 패키징 시 release 앱 리소스에 같이 포함됩니다.
- `save-tool` 설치 경로는 Electron `app.getPath("home")` 기준이라 다른 컴퓨터에서는 그 컴퓨터의 현재 사용자 홈 아래 `.codex/skills/save-tool`에 설치됩니다.
- 앱 하단에는 검정 배경/흰 글씨의 전역 알림 토스트 영역이 있습니다. 현재는 업데이트/중요 안내 표시 위치를 확인하는 기본 알림을 띄우며, 실제 새 버전 확인 로직은 아직 연결되지 않았습니다.
- `툴 등록` 버튼은 신규 툴/버전 업데이트 입력 폼을 먼저 표시한 뒤 `.md/.markdown` 파일을 선택하게 합니다.
- 툴 등록 저장 시 GitHub `tools/` 폴더에 바로 쓰지 않고 새 브랜치와 Pull Request를 생성합니다. 저장소 owner가 아닌 사용자는 fork 브랜치를 통해 원 저장소로 PR을 올립니다.
- 등록 방식이 `자유 등록`이고 위험 감지가 없는 안전한 툴이면 GitHub `tools/` 폴더에 직접 commit을 시도합니다. 저장소 push 권한이 없으면 자동으로 PR 생성 방식으로 전환됩니다.
- 등록 방식이 `승인제`이거나 위험 감지된 툴이면 GitHub PR을 생성하고, 관리자 머지 후 공유 목록에 반영됩니다.
- 위험 감지된 툴은 자유 등록이어도 앱 내부 승인 대기 상태로 저장됩니다.
- Custom Tools / More Tools 목록에서 PR이 있는 항목은 `승인 대기`, `머지됨`, `닫힘` 상태 배지와 `GitHub PR 보기` 링크를 표시합니다.
- Custom Tools / More Tools를 열거나 새로고침하면 PR 번호가 있는 툴의 GitHub PR 상태를 갱신합니다.
- Settings > 관리에는 `승인 대기 툴` 목록이 있으며 앱 승인, PR 보기, PR 상태 새로고침을 할 수 있습니다.
- 툴 등록 폼은 `.md/.markdown` 파일 선택 후 MD 미리보기와 위험 감지 결과를 표시합니다.
- Codex 사용자 스킬 `save-tool`은 `C:\Users\DONG KIM\.codex\skills\save-tool`에 설치되어 있습니다. 사용자가 `/save 툴이름`을 요청하면 GitHub 업로드 없이 로컬 `tool-drafts/툴이름.md` 초안을 만드는 용도입니다.
- GitHub에서 읽어오는 목록 동기화, GitHub Device Flow 로그인, 안전 툴 직접 commit, 위험/승인제 툴 Pull Request 생성, Pull Request 상태 추적은 연결되어 있습니다.
- GitHub Releases latest를 확인해 현재 앱 버전보다 새 릴리스가 있으면 하단 알림을 표시합니다. 실제 자동 업데이트 설치는 아직 연결되지 않았습니다.
- `packages/desktop/src/toolSharingPolicy.ts`는 공유 승인 정책과 버전 비교를 담당합니다. `App.tsx`가 커져 있으므로 이후 컴포넌트 분리는 `ToolMarketDialog`, `SettingsManagementPanel`, `TabStrip` 순서로 진행하는 것이 좋습니다.
- Custom Tools는 즐겨찾기 대신 상단고정(`pinned`) 상태를 사용합니다. 단, 메인페이지와 소메뉴에는 목록에서 `등록`한 커스텀 툴만 표시됩니다.
- Custom Tools / More Tools 목록은 검색과 컬럼 정렬을 지원하지만, 표시 그룹 순서는 항상 등록한 툴, 고정한 툴, 일반 툴 순서를 우선합니다. 행을 클릭하면 등록 시 입력한 설명이 아래로 펼쳐집니다.
- Share Tools 카드도 Custom Tools처럼 툴 이름 아래에 버전/제작자 메타를 표시합니다. 현재 기존 공유 툴은 기본 `v1.0.0 - MCP Registry`로 표시합니다.
- 좌측 메뉴에서 메뉴를 즐겨찾기하면 원래 메뉴 목록에서는 숨겨지고, 즐겨찾기 해제 시 다시 메뉴 목록에 나타납니다.
- Custom Tools / More Tools의 사용횟수 컬럼은 유지되어 있지만, 현재는 실제 MCP 실행 이벤트가 아직 연결되지 않았기 때문에 0으로 표시됩니다. 단순히 툴 페이지를 여는 동작으로는 증가하지 않습니다.
- Player view에서는 Custom Tools / More Tools 표의 제작자, 사용횟수 컬럼을 숨겨 좁은 창에서도 가로 스크롤 없이 보이도록 했습니다.
- Custom Flow는 본문 전체를 노드 캔버스로 사용합니다. 마우스 휠은 커서 위치 기준 줌, 마우스 휠 버튼 드래그는 패닝, 노드 헤더 드래그는 이동, 화살표 버튼은 노드 펼침/접힘입니다. 패닝 중에는 캔버스 커서가 `grabbing`으로 바뀝니다.
- Custom Flow 연결은 포트 단위로 저장됩니다. 입력/출력 포트에는 CAD/Revit/Excel/Object 같은 타입과 아이콘이 있고, 타입이 맞지 않는 연결은 점선 경고선으로 표시됩니다.
- Custom Flow 노드, 연결선, 줌 배율, 패닝 위치는 localStorage `mcp-registry:custom-flow-graph`에 저장됩니다.
- Custom Flow 격자는 `.flowCanvas` viewport 배경으로 그리며, CSS 변수 `--flow-grid-size`, `--flow-grid-x`, `--flow-grid-y`가 줌/패닝에 맞춰 업데이트됩니다. 월드 요소 밖 왼쪽/상단으로 패닝해도 격자가 끊기지 않도록 이 구조를 유지해야 합니다.
- Custom Flow 노드는 내부 좌우 포트 행에 입력/출력 아이콘과 텍스트를 표시하고, 연결선은 해당 포트 행 중앙 높이에 맞춰 붙습니다. 포트 행은 `button`이 아니라 일반 행 요소로 렌더링해 버튼처럼 보이지 않게 유지해야 합니다.
- Custom Flow 노드 배경, 입력/출력 커넥터, 연결선은 `App.tsx`의 프로그램/포트 타입 색상표를 사용합니다. 연결선 색상은 출발 출력 포트 타입을 기준으로 합니다.
- Custom Flow 입력 포트 커넥터는 hover 시 X 표시를 보여 클릭하면 연결을 끊을 수 있음을 알려줍니다.
- Custom Flow 캔버스 오른쪽 위에는 `흐름 점검` 아이콘 위젯이 있습니다. `packages/desktop/src/customFlowValidation.ts`에서 없는 노드/포트, 포트 타입 불일치, 연결되지 않은 입력을 검사합니다.
- 흐름 점검 아이콘은 정상/경고/오류 상태별로 색이 다르고, 경고/오류가 있으면 왼쪽 위 배지에 개수를 표시합니다. 항목을 클릭하면 관련 연결선이나 노드가 붉은색 계열로 하이라이트됩니다.
- Custom Flow 캔버스 오른쪽 위에는 뒤로가기, 되돌릴 위치 선택, 앞으로가기, 실행, 실행 설정 도구막대가 있습니다. 평소에는 반투명이고 hover/focus 시 선명해집니다.
- 실행 설정에서는 `일괄 실행`과 `단계별 실행`을 고를 수 있습니다. 현재는 실제 MCP 실행 엔진 연결 전 UI 단계라 실행 중인 노드 강조 상태만 표시합니다.
- Custom Flow에서는 빈 캔버스를 드래그해 여러 노드를 박스 선택할 수 있고, 선택된 노드 하나를 드래그하면 선택 묶음이 함께 이동합니다. `Ctrl/Shift` 클릭은 노드 선택을 토글합니다.
- Custom Flow에서 노드 헤더를 `Shift`를 누른 상태로 드래그하면 Smart Guides가 활성화됩니다. 다른 노드의 left/center/right, top/middle/bottom 기준에 가까우면 위치가 자동으로 붙고, 세 노드가 나란히 있을 때 같은 간격 위치도 스냅합니다. 같은 간격 스냅에는 `60px` 같은 치수 라벨이 함께 표시됩니다.
- Smart Guides 계산은 `packages/desktop/src/customFlowSmartGuides.ts`에 있으며, UI 표시선은 `.flowSmartGuideLayer`/`.flowSmartGuide` CSS가 담당합니다.
- Custom Flow 노드 우클릭 메뉴는 단축키를 함께 표시합니다. 그룹 만들기는 `Ctrl+G`, 복제는 `Ctrl+C` 후 `Ctrl+V`, 삭제는 `Del`입니다.
- Custom Flow에서 그룹에 포함된 노드를 우클릭하면 `그룹에서 제거` 메뉴가 추가로 나타납니다. 이 기능은 노드를 삭제하지 않고 그룹 소속만 해제합니다.
- Custom Flow 빈 캔버스 우클릭 또는 더블클릭으로 메모를 만들 수 있습니다. 메모는 localStorage `mcp-registry:custom-flow-graph`의 `notes`에 저장됩니다.
- Custom Flow 메모는 상단 제목줄 없이 표시합니다. 텍스트 영역을 클릭할 때만 문장을 수정하고, 메모의 빈 배경 영역을 드래그하면 이동합니다. 메모 박스는 오른쪽 아래 resize로 가로/세로 크기를 조절할 수 있습니다.
- Custom Flow 메모 색상은 오른쪽 위의 색상 점을 클릭해 팔레트에서 선택합니다. 메모의 텍스트, 위치, 폭, 높이, 색상은 `notes`에 저장됩니다.
- Custom Flow 흐름 점검은 오른쪽 위 고정 아이콘 위젯입니다. hover하면 상세가 보이고, 클릭하면 상세가 고정되며 다시 클릭하면 접힙니다. 상세 창은 최대 크기가 제한되어 있고 항목이 많으면 내부 목록만 스크롤됩니다.
- Custom Flow에서 `Esc`는 선택, 선택 박스, 연결 대기, 우클릭 메뉴, 드래그/패닝 임시 상태를 취소합니다.
- Custom Flow에서 노드 설명은 여러 개를 동시에 펼칠 수 있습니다. 노드 화살표를 눌러도 다른 노드의 펼침 상태는 유지됩니다.
- Custom Flow에서 선택된 노드를 우클릭해 `그룹 만들기`를 누르거나 `Ctrl+G`를 누르면 그룹 박스를 생성합니다. 그룹 박스를 드래그하면 포함된 노드들이 함께 이동합니다.
- Custom Flow 그룹과 메모는 박스 선택 또는 직접 클릭으로 선택할 수 있습니다. 선택한 메모는 Delete/Backspace로 삭제되고, 선택한 그룹은 노드를 삭제하지 않고 그룹 박스만 해제합니다.
- Custom Flow 그룹 헤더에서는 그룹 이름과 배경색을 바로 수정할 수 있습니다. 그룹 색상은 현재 색상 점을 클릭하면 팔레트가 펼쳐지는 방식입니다. 그룹 이름, 색상, 포함 노드 정보는 localStorage `mcp-registry:custom-flow-graph`의 `groups`에 저장됩니다.
- Custom Flow에서 노드를 그룹 박스 안으로 드래그하면 그룹이 추가 대상처럼 강조되고, 그 상태에서 놓으면 해당 그룹에 포함됩니다. `그룹에서 제거`를 누르면 선택 노드는 그룹 소속에서 빠지고 그룹 바깥쪽으로 이동해 결과가 눈에 보입니다.
- Custom Flow 오른쪽 위 도구막대의 `기본도구` 버튼은 기본 보조 도구 창을 엽니다. 창은 `툴`과 `연결값 도구` 탭으로 나뉩니다.
- Custom Flow 오른쪽 위 도구막대는 기본도구, 뒤로가기, 되돌릴 위치 선택, 앞으로가기, 실행, 실행 설정 화살표 순서입니다. 실행 설정은 톱니바퀴가 아니라 실행 버튼 옆 작은 화살표입니다.
- Custom Flow 앞으로가기는 도구막대 버튼 또는 `Ctrl+Y`로 실행합니다.
- 기본도구의 `툴` 탭에는 결과 미리보기, 경로 지정, 활성 파일, 프롬프트 기본 노드가 있습니다. 항목을 클릭하거나 캔버스에 드롭하면 노드가 추가됩니다.
- `결과 미리보기` 노드는 출력 포트가 없고, 펼쳤을 때 실행 결과를 노드 내부에 표시할 미리보기 영역을 가집니다.
- `프롬프트` 노드는 입력/출력 포트가 없고, 선으로 연결하지 않습니다. 노드 아래쪽으로 드래그해 다른 노드에 붙이면 해당 대상 노드 실행 시 프롬프트 문장을 추가하는 용도로 저장됩니다.
- 기본도구의 `연결값 도구` 탭 항목은 Input 또는 Output 포트 영역에 드롭하면 커스텀 포트를 추가합니다. `텍스트`는 공용이고, `경로`/`활성파일`은 input, `결과`는 output 전용으로 표시합니다.
- Custom Flow 노드는 왼쪽/상단 음수 좌표로도 이동할 수 있습니다. 연결선 SVG는 `overflow: visible` 구조를 전제로 하므로, 다시 좌표 clamp를 넣으면 좌상단 이동이 막힐 수 있습니다.
- Custom Flow 캔버스에서 마우스 휠 버튼을 누르고 드래그하면 패닝합니다. 노드, 그룹, 메모, 입력칸 위에서 휠 버튼을 눌러도 캔버스 이동이 우선됩니다. 휠 버튼을 빠르게 두 번 누르면 전체 노드가 보이도록 자동 fit 됩니다.
- Custom Flow 마우스 휠 줌 범위는 28%~180%입니다.
- Custom Flow의 포트/노드/저장/드래그 직렬화 모델은 `packages/desktop/src/customFlowModel.ts`로 분리되어 있습니다. UI 렌더링은 아직 `App.tsx`의 `WorkflowView`에 남아 있습니다.
- 상단 탭이 공간을 넘치면 `+` 대신 `...` 버튼이 나타나며, 화면에 보이지 않는 탭만 목록에 표시하고 목록 하단에서 새 탭을 만들 수 있습니다.
- 새 탭 `+`는 Home 페이지를 엽니다. Home 페이지에는 공지사항, 신규 커스텀 툴, Other Tools 카드가 있습니다.
- 탭 overflow(`...`) 리스트에서도 탭을 드래그해 순서를 바꿀 수 있고, 각 항목의 닫기 버튼으로 탭을 닫을 수 있습니다.
- 배포 실행 파일에서는 registry가 `%APPDATA%\ai-program\registry.json`에 저장됩니다. 최초 실행 시 bundled `data\registry.json`을 사용자 데이터 폴더로 복사합니다.
- Electron main/preload는 `dist-electron/main.cjs`, `dist-electron/preload.cjs`로 빌드합니다. `type: module` 프로젝트라 `.js` CommonJS 번들은 main process 오류가 납니다.
- 실행/중지 버튼은 Electron main의 MCP 프로세스 IPC와 연결되어 있습니다. 등록 서버의 `launchCommand`, `workingDirectory`, `environment`로 child process를 실행하고 stdout/stderr/오류/종료 로그를 Process Monitor에 표시합니다.
- 현재 프로세스 관리는 이 앱이 실행한 child process 기준입니다. 이미 외부에서 실행 중인 MCP 서버를 OS 프로세스 기준으로 찾아 중지하는 기능은 아직 없습니다.
- Settings의 MCP 서버 목록은 전체 서버를 보여주며, 이 창이 열려 있을 때 서버 선택도 전체 목록 기준으로 유지합니다. 일반 화면의 서버 상세 선택은 계속 현재 작업공간 필터 기준으로 동작합니다.
- Custom Flow 입력/출력 포트 안쪽에는 타입 아이콘을 표시하지 않습니다. 포트 타입 구분은 포트 네모와 연결선 색상을 주된 신호로 사용합니다.
- Custom Flow 연결선 좌표는 렌더링된 `.flowPortConnector` DOM의 실제 중심을 측정해 사용합니다. `customFlowModel.ts`의 `flowConnectionEndpoint`/`flowPortLocalY`는 측정값이 아직 없는 첫 렌더 시점의 fallback입니다.
- 포트 행 높이, 노드 헤더 여백, compact/expanded 레이아웃을 바꿔도 연결선은 DOM 측정값을 따라가야 합니다. 다시 고정 숫자만으로 선 좌표를 맞추면 같은 중심 어긋남이 재발할 수 있습니다.
- 다음 우선순위는 MCP 서버 연결 상태 확인 로직을 실제 포트/URL 점검으로 확장하고, Custom Flow 노드 그래프를 실제 MCP 툴 실행 엔진과 연결하는 작업입니다.
- `App.tsx`는 여전히 큽니다. 이번에는 `MonitorView`, Process Monitor 타입, Custom Flow 검증 로직을 먼저 분리했습니다. 이후에는 `WorkflowView`, `ToolMarketDialog`, `TabStrip`, Settings 세부 패널 순서로 계속 분리하는 것이 좋습니다.
- `node_modules` 안에 100MB 이상 Electron 실행 파일이 있으나 Git 제외 대상입니다.
- Codex 채팅 기록은 GitHub로 넘어가지 않습니다. 중요한 내용은 `WORK_LOG.md`, `TODO.md`, `README_HANDOFF.md`에 남겨야 합니다.

