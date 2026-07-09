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

개발 서버(`pnpm dev` 또는 `pnpm dev:web`)에서 보이는 화면과 `release` 폴더의 exe는 별개입니다. 소스 수정 후 실제 exe에도 반영하려면 반드시 `pnpm package:win`을 다시 실행해야 합니다.

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
- MD 파일 내용에서 객체/요소 삭제 또는 생성 후보 동작이 감지되면 Custom Tools / Market 리스트의 툴 이름 옆에 `주의` 배지가 표시됩니다. 배지를 클릭하면 감지 이유가 펼쳐지고, 메인페이지에서 실행할 때도 확인창이 표시됩니다.
- 소메뉴는 `Share Tools`, `Custom Tools` 분류명이 아니라 실제 툴 이름을 표시합니다. 소메뉴명과 설명은 소메뉴 페이지에서 바로 수정 가능하며 localStorage에 저장됩니다.
- Custom Tools 창은 메뉴별 커스텀 툴을 지원하고, 전체 공유 툴/Flow 관리는 Market 창에서 처리합니다.
- Custom Tools / Market 창에는 별도 GitHub 버튼을 표시하지 않습니다.
- Custom Tools / Market 창을 열면 GitHub 저장소 `kdg200121-hash/AI_PROGRAM`의 `tools/` 폴더에서 `.md/.markdown` 툴 목록을 자동으로 읽어옵니다.
- GitHub에서 가져온 툴은 MD frontmatter의 `author`를 우선 사용하고, 없으면 저장소 owner인 `kdg200121-hash`를 제작자로 표시합니다.
- `tools/` 폴더에 아직 MD 툴이 없으면 창 상단에 등록된 MD 툴이 없다는 상태 메시지만 표시됩니다.
- 기존 localStorage에 남아 있던 로컬 MD 동기화 툴은 더 이상 목록에 표시하지 않습니다. `sourcePath` 또는 `installedPath`가 `github:kdg200121-hash/AI_PROGRAM/tools/`로 시작하는 항목만 로드합니다.
- 좌측 상단 브랜드 영역의 버전 줄에는 로그인 버튼이 있습니다. 로그인 전에는 `로그인`, 로그인 후에는 `닉네임님`으로 표시됩니다.
- 로그인은 GitHub OAuth Device Flow 기반입니다. GitHub 로그인 시작 시 브라우저가 열리고 앱에는 user code와 `인증 완료 확인` 버튼이 표시됩니다.
- GitHub OAuth scope는 `read:user public_repo`입니다. 기존 로그인 토큰에 `public_repo` 권한이 없으면 툴 등록 PR 생성이 실패할 수 있으므로 로그아웃 후 다시 로그인해야 합니다.
- GitHub OAuth App Client ID는 `data/github-oauth.json`에 들어 있으며 패키징된 앱에 포함됩니다. 일반 사용자는 별도 환경 변수를 설정하지 않아도 됩니다.
- 개발 중 다른 OAuth App을 쓰고 싶으면 실행 환경에 `AI_PROGRAM_GITHUB_CLIENT_ID` 또는 `VITE_GITHUB_CLIENT_ID`를 설정해 bundled 값을 덮어쓸 수 있습니다.
- GitHub access token은 renderer localStorage가 아니라 Electron 사용자 데이터 폴더의 `github-auth.json`에 저장합니다. Electron `safeStorage`로 암호화할 수 있을 때만 `safe:` prefix로 저장하고, 암호화할 수 없으면 토큰 저장과 로그인을 중단합니다. renderer에는 GitHub ID/닉네임/아바타 URL만 노출합니다.
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
- 툴 등록 승인제에서 일반 사용자가 추가한 커스텀 툴은 `승인 대기` 배지와 함께 Custom Tools / Market 목록에 표시되고, 관리자 승인 후 등록/해제 버튼을 사용할 수 있습니다.
- 현재 계정 정책과 회원 목록은 앱 localStorage 기반입니다. 다른 컴퓨터까지 중앙에서 강제하려면 GitHub 저장소 또는 별도 서버에 정책/회원 목록을 동기화하는 후속 구현이 필요합니다.
- Home의 `Other Tools` 카드는 `채팅을 TOOL로 저장` 안내와 다운로드 아이콘 버튼을 표시합니다. 버튼을 누르면 앱에 포함된 `save-tool` Codex 스킬이 현재 사용자 `~/.codex/skills/save-tool`에 설치되어, `/save 툴이름` 명령으로 해당 채팅을 로컬 MD TOOL 초안으로 저장할 수 있습니다.
- `save-tool` 설치 원본은 `packages/desktop/assets/skills/save-tool`에 있으며, Windows 패키징 시 release 앱 리소스에 같이 포함됩니다.
- `save-tool` 설치 경로는 Electron `app.getPath("home")` 기준이라 다른 컴퓨터에서는 그 컴퓨터의 현재 사용자 홈 아래 `.codex/skills/save-tool`에 설치됩니다.
- 앱 하단에는 검정 배경/흰 글씨의 전역 알림 토스트 영역이 있습니다. 현재는 업데이트/중요 안내 표시 위치를 확인하는 기본 알림을 띄우며, 실제 새 버전 확인 로직은 아직 연결되지 않았습니다.
- `툴 등록` 버튼은 신규 툴/버전 업데이트 입력 폼을 먼저 표시한 뒤 `.md/.markdown` 파일을 선택하게 합니다.
- 툴 등록 저장 시 GitHub `tools/` 폴더에 바로 쓰지 않고 새 브랜치와 Pull Request를 생성합니다. 저장소 owner가 아닌 사용자는 fork 브랜치를 통해 원 저장소로 PR을 올립니다.
- 등록 방식이 `자유 등록`이고 위험 감지가 없는 안전한 툴이면 GitHub `tools/` 폴더에 직접 commit을 시도합니다. 저장소 push 권한이 없으면 자동으로 PR 생성 방식으로 전환됩니다.
- 등록 방식이 `승인제`이거나 위험 감지된 툴이면 GitHub PR을 생성하고, 관리자 머지 후 공유 목록에 반영됩니다.
- 위험 감지된 툴은 자유 등록이어도 앱 내부 승인 대기 상태로 저장됩니다.
- Custom Tools / Market 목록에서 PR이 있는 항목은 `승인 대기`, `머지됨`, `닫힘` 상태 배지와 `GitHub PR 보기` 링크를 표시합니다.
- Custom Tools / Market을 열거나 새로고침하면 PR 번호가 있는 툴의 GitHub PR 상태를 갱신합니다.
- Settings > 관리에는 `승인 대기 툴` 목록이 있으며 앱 승인, PR 보기, PR 상태 새로고침을 할 수 있습니다.
- 툴 등록 폼은 `.md/.markdown` 파일 선택 후 MD 미리보기와 위험 감지 결과를 표시합니다.
- Codex 사용자 스킬 `save-tool`은 현재 Windows 사용자 홈의 `.codex\skills\save-tool`에 설치됩니다. 사용자가 `/save 툴이름`을 요청하면 GitHub 업로드 없이 로컬 `tool-drafts/툴이름.md` 초안을 만드는 용도입니다.
- GitHub에서 읽어오는 목록 동기화, GitHub Device Flow 로그인, 안전 툴 직접 commit, 위험/승인제 툴 Pull Request 생성, Pull Request 상태 추적은 연결되어 있습니다.
- GitHub Releases latest를 확인해 현재 앱 버전보다 새 릴리스가 있으면 하단 알림을 표시합니다. 실제 자동 업데이트 설치는 아직 연결되지 않았습니다.
- `packages/desktop/src/toolSharingPolicy.ts`는 공유 승인 정책과 버전 비교를 담당합니다. `App.tsx`가 커져 있으므로 이후 컴포넌트 분리는 `ToolMarketDialog`, `SettingsManagementPanel`, `TabStrip` 순서로 진행하는 것이 좋습니다.
- Custom Tools는 즐겨찾기 대신 상단고정(`pinned`) 상태를 사용합니다. 단, 메인페이지와 소메뉴에는 목록에서 `등록`한 커스텀 툴만 표시됩니다.
- Custom Tools / Market 목록은 검색과 컬럼 정렬을 지원하지만, 표시 그룹 순서는 항상 등록한 툴, 고정한 툴, 일반 툴 순서를 우선합니다. 행을 클릭하면 등록 시 입력한 설명이 아래로 펼쳐집니다.
- Share Tools 카드도 Custom Tools처럼 툴 이름 아래에 버전/제작자 메타를 표시합니다. 현재 기존 공유 툴은 기본 `v1.0.0 - MCP Registry`로 표시합니다.
- 좌측 메뉴에서 메뉴를 즐겨찾기하면 원래 메뉴 목록에서는 숨겨지고, 즐겨찾기 해제 시 다시 메뉴 목록에 나타납니다.
- Custom Tools / Market의 사용횟수 컬럼은 유지되어 있지만, 현재는 실제 MCP 실행 이벤트가 아직 연결되지 않았기 때문에 0으로 표시됩니다. 단순히 툴 페이지를 여는 동작으로는 증가하지 않습니다.
- Player view에서는 Custom Tools / Market 표의 제작자, 사용횟수 컬럼을 숨겨 좁은 창에서도 가로 스크롤 없이 보이도록 했습니다.
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
- 실행 설정에서는 `일괄 실행`과 `단계별 실행`을 고르고, 실행 범위를 `전체 흐름`, `선택 노드만`, `선택 노드까지`, `선택 노드부터` 중에서 선택할 수 있습니다. 현재는 실제 MCP 실행 엔진 연결 전 UI/모델 단계라 실행 중인 노드 강조, 실행 로그, 예상 중간결과를 표시합니다.
- Custom Flow를 실행하면 오른쪽에 실행 로그 타임라인이 열립니다. 상단에는 이번 실행의 영향 범위, 필요 MCP 서버, 예정 MCP 명령을 요약하고, 각 로그 항목을 클릭하면 해당 노드로 이동해 `결과` 탭을 엽니다.
- Custom Flow 노드 상세에는 `작동 원리`, `설정`, `결과` 탭이 있습니다. `결과` 탭은 실행 후 노드별 중간결과 미리보기, 주요 값, 샘플 행, 실행 전 영향 범위를 보여줍니다.
- Custom Flow에서는 빈 캔버스를 드래그해 여러 노드를 박스 선택할 수 있고, 선택된 노드 하나를 드래그하면 선택 묶음이 함께 이동합니다. `Ctrl/Shift` 클릭은 노드 선택을 토글합니다.
- Custom Flow에서 노드 헤더를 `Shift`를 누른 상태로 드래그하면 Smart Guides가 활성화됩니다. 다른 노드의 left/center/right, top/middle/bottom 기준에 가까우면 위치가 자동으로 붙고, 세 노드가 나란히 있을 때 같은 간격 위치도 스냅합니다. 같은 간격 스냅에는 `60px` 같은 치수 라벨이 함께 표시됩니다.
- Smart Guides 계산은 `packages/desktop/src/customFlowSmartGuides.ts`에 있으며, UI 표시선은 `.flowSmartGuideLayer`/`.flowSmartGuide` CSS가 담당합니다.
- Custom Flow 노드 우클릭 메뉴는 단축키를 함께 표시합니다. 그룹 만들기는 `Ctrl+G`, 복제는 `Ctrl+C` 후 `Ctrl+V`, 삭제는 `Del`입니다.
- Custom Flow에서 그룹에 포함된 노드를 우클릭하면 `그룹에서 제거` 메뉴가 추가로 나타납니다. 이 기능은 노드를 삭제하지 않고 그룹 소속만 해제합니다.
- Custom Flow 빈 캔버스 우클릭 또는 더블클릭으로 메모를 만들 수 있습니다. 메모는 localStorage `mcp-registry:custom-flow-graph`의 `notes`에 저장됩니다.
- Custom Flow 메모는 상단 제목 입력칸과 이동 손잡이를 가집니다. 제목 입력칸은 메모 윗부분 글씨를 바꾸는 용도이고, 손잡이를 드래그하면 메모를 이동합니다. 본문 텍스트 영역을 클릭할 때만 메모 내용을 수정합니다. 메모 박스는 오른쪽 아래 resize로 가로/세로 크기를 조절할 수 있습니다.
- Custom Flow 메모 색상은 오른쪽 위의 색상 점을 클릭해 팔레트에서 선택합니다. 메모의 텍스트, 위치, 폭, 높이, 색상은 `notes`에 저장됩니다.
- Custom Flow 흐름 점검은 오른쪽 위 고정 아이콘 위젯입니다. hover하면 상세가 보이고, 클릭하면 상세가 고정되며 다시 클릭하면 접힙니다. 상세 창은 최대 크기가 제한되어 있고 항목이 많으면 내부 목록만 스크롤됩니다.
- Custom Flow에서 `Esc`는 선택, 선택 박스, 연결 대기, 우클릭 메뉴, 드래그/패닝 임시 상태를 취소합니다.
- Custom Flow에서 노드 설명은 여러 개를 동시에 펼칠 수 있습니다. 노드 화살표를 눌러도 다른 노드의 펼침 상태는 유지됩니다.
- Custom Flow의 `활성 파일` 노드는 선택한 프로그램이 하나일 때 그 프로그램을 출력 포트 타입으로 사용합니다. 예를 들어 CAD를 선택하면 출력 포트가 `cad` 타입이 되어 `CAD 객체 읽기` 입력과 호환됩니다.
- `활성 파일` 노드의 첫 상세 탭은 `프로그램`으로 표시되며, `새로고침` 버튼은 등록된 CAD/Revit/Excel MCP 서버의 `/active-file`, `/current-file`, `/status` 계열 endpoint에서 현재 파일명을 읽으려고 시도합니다. AutoCAD와 Excel 공통 브리지는 각각 활성 문서/워크북을 읽습니다. Revit은 일반 PowerShell 브리지에서 프로세스 감지만 가능하므로 실제 활성 문서명은 Revit 애드인 브리지 연결 후 제공해야 합니다.
- Revit 애드인 브리지 1차 소스는 `tools/mcp-bridges/revit-addin-bridge`에 있습니다. `RevitMcpBridge.csproj`는 Revit 2025 기본 설치 경로의 `RevitAPI.dll`, `RevitAPIUI.dll`을 참조하며, 빌드 후 `scripts/install-addin.ps1 -RevitYear 2025`로 `%APPDATA%\Autodesk\Revit\Addins\2025\AIProgramRevitMcpBridge.addin` manifest를 설치합니다. Revit 안에서 로드되면 `http://127.0.0.1:5101/active-file`이 `ActiveUIDocument.Document.PathName`을 반환하도록 구성했습니다.
- Revit 애드인 브리지는 Revit 기본 `Add-Ins` 탭, 한글 UI 기준 `애드인` 탭에 `AI Program` 패널과 `AI Program MCP` 상태 확인 버튼을 추가합니다. 버튼은 브리지 endpoint 안내용이고, 실제 파일명 읽기는 `/active-file` endpoint가 담당합니다.
- 앱 registry의 Revit 서버는 Revit 애드인이 이미 띄운 `http://localhost:5101/mcp` endpoint를 확인하는 항목입니다. AutoCAD/Excel처럼 앱이 별도 PowerShell bridge 프로세스를 실행하지 않으므로 `launchCommand`와 `workingDirectory`는 비워 두는 것이 기준입니다.
- Revit 애드인 MCP 브리지는 `revit.get_active_document`와 `revit.list_levels` 안전 읽기 명령을 제공합니다. `revit.list_levels`는 `/mcp` JSON-RPC `tools/call` 또는 `/tools/revit.list_levels`로 호출하며, 레벨 이름과 elevation 값만 읽고 모델을 수정하지 않습니다.
- Custom Flow에서 선택된 노드를 우클릭해 `그룹 만들기`를 누르거나 `Ctrl+G`를 누르면 그룹 박스를 생성합니다. 그룹 박스를 드래그하면 포함된 노드들이 함께 이동합니다.
- Custom Flow 그룹과 메모는 박스 선택 또는 직접 클릭으로 선택할 수 있습니다. 선택한 메모는 Delete/Backspace로 삭제되고, 선택한 그룹은 노드를 삭제하지 않고 그룹 박스만 해제합니다.
- 메모 텍스트 영역에 포커스가 있을 때는 일반 Delete/Backspace가 텍스트 편집에 쓰입니다. 이 상태에서 메모 자체를 삭제하려면 `Ctrl+Delete`를 사용합니다. 메모 위에서 `Shift+드래그`하면 메모 이동 대신 선택 박스가 시작됩니다.
- Custom Flow 메모를 우클릭하면 `복제`, `삭제` 메뉴가 나타납니다. 텍스트 편집 중인 메모를 확실히 삭제하려면 우클릭 메뉴 삭제 또는 `Ctrl+Delete`를 사용합니다.
- Custom Flow 메모/노드 우클릭 메뉴는 좁은 창에서도 화면 밖으로 잘리지 않도록 위치를 자동 보정합니다. 메모 제목 입력칸이나 본문 textarea 안에서 우클릭해도 같은 `복제`/`삭제` 메뉴가 열립니다.
- Custom Flow 그룹 헤더에서는 그룹 이름과 배경색을 바로 수정할 수 있습니다. 그룹 색상은 현재 색상 점을 클릭하면 팔레트가 펼쳐지는 방식입니다. 그룹 이름, 색상, 포함 노드 정보는 localStorage `mcp-registry:custom-flow-graph`의 `groups`에 저장됩니다.
- Custom Flow 그룹 헤더에는 `Flow 저장` 버튼이 있습니다. 이 버튼은 그룹 내부 노드와 연결을 `MY Flow`에 저장합니다. 저장한 Flow는 다른 캔버스에서 메뉴/카드 선택 또는 드래그로 그룹 형태로 삽입할 수 있습니다.
- Custom Flow에서 노드를 그룹 박스 안으로 드래그하면 그룹이 추가 대상처럼 강조되고, 그 상태에서 놓으면 해당 그룹에 포함됩니다. `그룹에서 제거`를 누르면 선택 노드는 그룹 소속에서 빠지고 그룹 바깥쪽으로 이동해 결과가 눈에 보입니다.
- Custom Flow 오른쪽 위 도구막대의 `기본도구` 버튼은 기본 보조 도구 창을 엽니다. 창은 `툴`과 `연결값 도구` 탭으로 나뉩니다.
- Custom Flow 오른쪽 위 도구막대는 검색, 뒤로가기, 되돌릴 위치 선택, 앞으로가기, 실행, 실행 설정 화살표, 기본도구 순서로 표시됩니다. 기본도구 버튼은 흐름 점검 아이콘 바로 왼쪽에 붙어 보이도록 오른쪽 끝에 정렬합니다. 실행 설정은 톱니바퀴가 아니라 실행 버튼 옆 작은 화살표입니다.
- Custom Flow 오른쪽 위 도구막대에는 `검색` 버튼이 있습니다. `Ctrl+F`로도 열 수 있으며, 노드 이름/설명/포트 라벨을 검색하고 결과를 클릭하면 해당 노드가 선택되고 화면 중앙으로 이동합니다.
- Custom Flow 앞으로가기는 도구막대 버튼 또는 `Ctrl+Y`로 실행합니다.
- 기본도구의 `툴` 탭에는 결과 미리보기, 경로 지정, 활성 파일, 프롬프트 기본 노드가 있습니다. 항목을 클릭하거나 캔버스에 드롭하면 노드가 추가됩니다.
- `결과 미리보기` 노드는 출력 포트가 없고, 펼쳤을 때 실행 결과를 노드 내부에 표시할 미리보기 영역을 가집니다.
- `활성 파일` 노드는 입력 포트 없이 현재 열려 있는 파일 값을 출력하는 보조 노드로 표시합니다.
- `프롬프트` 노드는 입력/출력 포트가 없고, 선으로 연결하지 않습니다. 노드 아래쪽으로 드래그해 다른 노드에 붙이면 해당 대상 노드 실행 시 프롬프트 문장을 추가하는 용도로 저장됩니다.
- Custom Flow 실행은 `window.toolExecution.run`을 통해 실제 MCP 실행 요청을 보냅니다. 일괄 실행을 누르면 연결선 기준 순서대로 한 노드씩 실행되고, 각 노드의 실제 MCP 응답값이 다음 노드 입력으로 전달됩니다. 흐름 점검에서 오류/경고가 있는 노드는 해당 노드에 별도 배지와 테두리가 표시됩니다.
- 기본도구의 `연결값 도구` 탭 항목은 Input 또는 Output 포트 영역에 드롭하면 커스텀 포트를 추가합니다. `텍스트`는 공용이고, `경로`/`활성파일`은 input, `결과`는 output 전용으로 표시합니다.
- `연결값 도구`에는 텍스트, 숫자, 좌표, 객체, 테이블, 파일, 폴더, 참/거짓, 활성파일, 선택 요소, 결과, 로그, 오류, 리포트가 있습니다. 가능한 항목은 공용 포트로 두고, 선택 요소/활성파일은 input, 결과/로그/오류/리포트는 output 전용으로 표시합니다.
- 출력 포트를 선택해 연결 대기 상태가 되면 입력 포트가 초록색 또는 붉은색으로 미리 강조됩니다. 초록색은 타입 호환, 붉은색은 연결은 가능하지만 타입 경고가 생길 수 있다는 의미입니다.
- Custom Flow의 다음 디자인/기능 후보는 미니맵, 노드 검색, reroute 노드, subflow, 실행 로그 타임라인, 포트 자동 변환 노드, 정렬/배치 명령 팔레트입니다.
- Custom Flow 노드는 왼쪽/상단 음수 좌표로도 이동할 수 있습니다. 연결선 SVG는 `overflow: visible` 구조를 전제로 하므로, 다시 좌표 clamp를 넣으면 좌상단 이동이 막힐 수 있습니다.
- Custom Flow 캔버스에서 마우스 휠 버튼을 누르고 드래그하면 패닝합니다. 노드, 그룹, 메모, 입력칸 위에서 휠 버튼을 눌러도 캔버스 이동이 우선됩니다. 휠 버튼을 빠르게 두 번 누르면 전체 노드가 보이도록 자동 fit 됩니다.
- Custom Flow 마우스 휠 줌 범위는 28%~180%입니다.
- 메모 제목/본문 입력 중 `Esc`를 누르면 입력 focus를 해제하고 열린 메뉴/색상 팔레트를 닫습니다. 입력칸이 아닌 캔버스, 노드, 그룹을 클릭해도 현재 입력칸 focus가 해제됩니다.
- Custom Flow의 포트/노드/저장/드래그 직렬화 모델은 `packages/desktop/src/customFlowModel.ts`로 분리되어 있습니다. UI 렌더링은 아직 `App.tsx`의 `WorkflowView`에 남아 있습니다.
- MD 툴 frontmatter의 `settings`, `inputs`, `outputs`, `requiredServers`, `mcpCommands`, `preflightChecks`, `resultSchema`, `failurePolicy`는 `packages/desktop/src/toolSettingsSchema.ts`에서 파싱합니다. Custom Tools / Market에서 읽은 schema는 Custom Flow 노드로 전달되고, 노드의 `설정` 탭에서 자동 설정창으로 표시됩니다.
- schema의 정의 오류, 필수 설정값 누락, 예정 MCP 명령 파라미터 해석은 `packages/desktop/src/toolRuntimeValidation.ts`가 담당합니다. Custom Tool 등록창에서는 설정창 미리보기/검증/테스트 실행 요약을 보여주고, Custom Flow 검증은 노드별 필수 설정 누락을 흐름 점검에 포함합니다.
- Custom Flow 기본 CAD/Excel/Revit 노드에는 `mcpCommands.status: planned` 명령 계획이 들어 있습니다. 실행 버튼은 `packages/desktop/src/customFlowExecutionModel.ts`에서 노드별 요청을 만들고 `App.tsx`의 `runFlow`가 순서대로 `window.toolExecution.run`을 호출합니다.
- Custom Flow 도구 창에는 `Revit 레벨 읽기` 노드가 있습니다. 이 노드는 입력 없이 현재 열린 Revit 모델을 읽고 `revit.list_levels` MCP 명령을 실행합니다. 실행 로그/결과 미리보기에는 `Revit 레벨 목록`으로 표시되며, 실제 응답의 `levels` 배열은 `레벨 ID`, `레벨 이름`, `높이(ft)` 표로 변환됩니다. Revit 요소 생성/수정은 아직 구현하지 않았고, 현재 검증된 Revit 명령은 활성 문서 읽기와 레벨 목록 읽기입니다.
- Custom Flow 실행 범위, 실행 로그, 노드별 미리보기, 그룹 툴 schema 생성 로직은 `packages/desktop/src/customFlowRunModel.ts`에 있습니다. 실제 MCP 응답 정규화, 앞 노드 결과 전달, 실패/부분성공 처리 모델은 `packages/desktop/src/customFlowExecutionModel.ts`에 있습니다.
- `/make`와 `/save` 스킬은 설정창 구성이 어느 정도 잡히면 한글 목업을 먼저 보여주고 승인받은 뒤 MD 파일을 만들도록 되어 있습니다. 앱 내 스킬 리소스와 `C:\Users\Donggeon\.codex\skills` 로컬 스킬이 동기화되어 있습니다.
- 현재 설정창 렌더링은 2차 UI입니다. `mapping-table`, `filter-builder`, `sort-rule`, `repeatable-list`는 행 추가/삭제 방식으로 편집할 수 있습니다. 다음 단계에서는 실제 CAD/Revit/Excel 서버 상태를 읽어 레이어, 레벨, 패밀리, 파라미터 선택지를 동적으로 채우는 작업이 필요합니다.
- 상단 탭이 공간을 넘치면 `+` 대신 `...` 버튼이 나타나며, 화면에 보이지 않는 탭만 목록에 표시하고 목록 하단에서 새 탭을 만들 수 있습니다.
- 새 탭 `+`는 Home 페이지를 엽니다. Home 페이지에는 공지사항, 신규 커스텀 툴, Other Tools 카드가 있습니다.
- 탭 overflow(`...`) 리스트에서도 탭을 드래그해 순서를 바꿀 수 있고, 각 항목의 닫기 버튼으로 탭을 닫을 수 있습니다.
- 배포 실행 파일에서는 registry가 `%APPDATA%\ai-program\registry.json`에 저장됩니다. 최초 실행 시 bundled `data\registry.json`을 사용자 데이터 폴더로 복사합니다.
- Electron main/preload는 `dist-electron/main.cjs`, `dist-electron/preload.cjs`로 빌드합니다. `type: module` 프로젝트라 `.js` CommonJS 번들은 main process 오류가 납니다.
- 실행/중지 버튼은 Electron main의 MCP 프로세스 IPC와 연결되어 있습니다. 등록 서버의 `launchCommand`, `workingDirectory`, `environment`로 child process를 실행하고 stdout/stderr/오류/종료 로그를 Process Monitor에 표시합니다.
- 현재 프로세스 관리는 이 앱이 실행한 child process 기준입니다. 이미 외부에서 실행 중인 MCP 서버를 OS 프로세스 기준으로 찾아 중지하는 기능은 아직 없습니다.
- Settings의 MCP 서버 목록은 전체 서버를 보여주며, 이 창이 열려 있을 때 서버 선택도 전체 목록 기준으로 유지합니다. 일반 화면의 서버 상세 선택은 계속 현재 작업공간 필터 기준으로 동작합니다.
- Settings의 MCP 서버 상세는 읽기 전용입니다. 서버 등록/수정은 앱 설정 UI에서 직접 하지 않고 `/등록` 스킬이 registry 항목을 만들거나 앱 시작 시 bundled bridge 항목을 병합하는 흐름을 기준으로 합니다.
- registry JSON은 UTF-8 BOM이 있어도 core `loadRegistry`가 제거한 뒤 파싱합니다. `mcp-processes:get-snapshot`에서 `Unexpected token '﻿'` 오류가 나면 userData registry 파일이 BOM 또는 깨진 JSON인지 먼저 확인하세요.
- Custom Flow에서 새 플로우 `+`는 빈 캔버스를 열고 저장 목록에 즉시 추가하지 않습니다. 사용자가 저장하지 않고 나가면 내 플로우 목록에 남지 않는 것이 의도입니다.
- Custom Flow 캔버스 툴바에는 Home/메인 이동 버튼이 없습니다. 저장은 디스크 아이콘, 노드 검색은 돋보기 아이콘 버튼입니다.
- Custom Flow 노드 상세 탭은 `작동 원리`, `설정`, `결과` 3개가 한 줄에 표시되는 것이 현재 기준입니다.
- 툴 업데이트는 처음 등록한 제작자만 가능합니다. 현재 로그인한 닉네임 또는 GitHub ID가 기존 툴의 `author`와 일치해야 버전 업데이트가 진행됩니다.
- Market/Custom Tools에서 로컬 원본 파일 삭제는 사용자가 승인한 툴 폴더와 앱/프로젝트 `tools` 폴더 안에서만 허용됩니다. 임의 경로 삭제는 계속 막아야 합니다.
- 툴 삭제 시 이미 존재하지 않는 로컬 원본 파일은 성공 처리합니다. localStorage에 오래된 sourcePath/installedPath가 남아 있을 수 있으므로, 존재 여부 확인을 허용 루트 검사보다 먼저 수행하는 구조를 유지해야 합니다.
- Market/Custom Tools 필터는 `툴 이름` 테이블 헤더 옆 작은 아이콘 버튼 기준입니다. 다시 큰 필터 줄로 되돌리면 목록 영역이 좁아져 사용자가 싫어했던 상태가 됩니다.
- Player view에서 툴을 선택하면 탭을 새로 열지 않고 클릭한 툴 카드 바로 아래에서 그 자리 확장 방식으로 실행 패널이 펼쳐집니다. 이 패널은 버튼 한 줄과 설정값 입력 영역을 기준으로 유지해야 합니다.
- Custom Flow 메인 화면은 다른 메인 페이지와 같은 카드 기준을 사용합니다. 공유 플로우/내 플로우 헤더는 제목과 설명을 같은 세로 그룹으로 묶고, 카드 선택은 클릭으로 열기, 내 플로우 복제/삭제는 우클릭 메뉴 기준입니다.
- Custom Flow 메인 화면의 Share Flow는 `내 플로우로 가져오기` 버튼을 쓰지 않습니다. Share Flow 카드를 클릭하면 바로 캔버스로 열고, 저장할 때 새 My Flow로 저장하는 흐름이 기준입니다.
- Custom Flow에서 저장하지 않고 나갈 때는 브라우저 기본 `confirm`을 쓰지 않고 앱 디자인에 맞춘 확인 모달을 사용해야 합니다.
- Custom Flow 기본 도구 창의 `툴`/`연결값 도구` 탭은 스크롤 중에도 상단에 고정합니다. 연결값 도구는 프로그램 필터와 공용/입력/출력 필터를 함께 지원합니다.
- Custom Flow `연결값 도구` 필터는 기본 접힘 상태가 기준입니다. 도구 목록이 좁아 보이지 않도록 현재 필터 요약만 보이고, 사용자가 눌렀을 때만 작은 필터 칩을 펼칩니다.
- Custom Flow 출시 전 시뮬레이션 회귀 테스트는 `packages/desktop/src/customFlowPreRelease.test.ts`입니다. 기본 CAD -> Excel 흐름의 검증, 실행 순서, 예상 실행 로그, 그룹 삽입, 재사용 가능한 custom-flow schema 생성까지 확인합니다.
- Custom Flow 그룹을 툴 schema로 저장할 때는 내부 노드 설정을 `nodeId__settingId`로 namespacing하고, MCP command의 `settings.*` 참조도 같은 ID로 재매핑해야 합니다. 이 매핑이 빠지면 runtime validation에서 없는 설정 참조 에러가 납니다.
- 현재 Custom Flow `실행` 버튼은 실제 MCP 서버 호출 경로와 연결되어 있습니다. 출시 기준으로 남은 핵심 작업은 AutoCAD/Revit/Excel 브리지의 실제 SDK 명령 구현, 위험 작업 롤백/보상 명령 정책, 실제 bridge별 `available` 명령 자동 검증입니다.
- 기본 전체 창 크기는 1440x900입니다. 사용자가 캔버스 작업 공간이 작다고 했기 때문에 임의로 다시 줄이지 마세요.
- Settings에는 `AI 연결` 탭이 없습니다. 이 앱은 현재 OpenAI API 키를 저장하거나 직접 OpenAI로 툴 실행을 보내지 않고, 등록된 MCP 서버/명령 기준으로만 실행 통로를 둡니다.
- `/등록` 스킬은 MCP 서버 등록/검증, 브리지 스캐폴드 생성, URL/포트/명령 목록 확인 기준으로 안내합니다. AI API 키 설정 안내를 다시 추가하지 마세요.
- Custom Flow 입력/출력 포트 안쪽에는 타입 아이콘을 표시하지 않습니다. 포트 타입 구분은 포트 네모와 연결선 색상을 주된 신호로 사용합니다.
- Custom Flow 연결선 좌표는 렌더링된 `.flowPortConnector` DOM의 실제 중심을 측정해 사용합니다. `customFlowModel.ts`의 `flowConnectionEndpoint`/`flowPortLocalY`는 측정값이 아직 없는 첫 렌더 시점의 fallback입니다.
- 포트 행 높이, 노드 헤더 여백, compact/expanded 레이아웃을 바꿔도 연결선은 DOM 측정값을 따라가야 합니다. 다시 고정 숫자만으로 선 좌표를 맞추면 같은 중심 어긋남이 재발할 수 있습니다.
- 다음 우선순위는 실제 AutoCAD/Revit/Excel 브리지에서 안전한 읽기 명령 1개씩 구현/검증하고, Custom Flow가 그 응답을 노드 간에 제대로 전달하는지 실제 프로그램으로 확인하는 작업입니다.
- `App.tsx`는 여전히 큽니다. 이번에는 `MonitorView`, Process Monitor 타입, Custom Flow 검증 로직을 먼저 분리했습니다. 이후에는 `WorkflowView`, `ToolMarketDialog`, `TabStrip`, Settings 세부 패널 순서로 계속 분리하는 것이 좋습니다.
- `node_modules` 안에 100MB 이상 Electron 실행 파일이 있으나 Git 제외 대상입니다.
- Codex 채팅 기록은 GitHub로 넘어가지 않습니다. 중요한 내용은 `WORK_LOG.md`, `TODO.md`, `README_HANDOFF.md`에 남겨야 합니다.
- 앱 내장 `/등록` 스킬(`program-mcp-registrar`)은 MCP 등록값만 안내하지 않고, 브리지 스캐폴드 생성, AI Program 등록, URL/포트 확인, 명령 목록 확인, 안전한 읽기 테스트까지 진행하는 기준으로 작성되어 있습니다. 단, 실제 AutoCAD/Revit/Excel SDK 호출 브리지 템플릿은 아직 TODO로 남아 있으므로 스킬 실행 시 검증된 단계와 미검증 단계를 분리해서 보고해야 합니다.
- AutoCAD 기본 브리지는 `tools/mcp-bridges/program-bridge/program-mcp-bridge.ps1`에서 실제 AutoCAD COM 세션을 읽습니다. 현재 실기 검증된 안전 명령은 `cad.get_active_document`, `cad.list_layers`입니다. `cad.detect_title_block_candidates`는 종이공간/layout 블록 기준으로 빠르게 검사하며, `scope=selection`이면 사용자가 AutoCAD에서 선택한 블록 참조를 후보로 반환합니다.
- `cad.read_objects`는 현재 AutoCAD 선택 객체만 읽는 `available` 명령입니다. `scope: selection/current_selection/selected`만 허용하며, 선택이 없으면 `ok:false`, `code: selectionRequired`를 반환합니다. 모델 공간 전체 순회와 AutoCAD SelectionSet 전체 스캔은 큰 DWG에서 COM bridge를 막을 수 있어 사용하지 않습니다. 다음 단계는 사용자가 지정한 안전 window/range와 실제 Text/MText 위치 추출입니다.
- `cad.renumber_selected_text`는 AutoCAD에서 사용자가 미리 선택한 TEXT/MTEXT만 순번 변경 대상으로 삼는 첫 안전 수정 명령입니다. 기본은 미리보기이며, 실제 변경은 `apply=true`와 `confirmApply=true`가 함께 들어올 때만 수행합니다. 도면 전체 ModelSpace 순회와 `$doc.Save()` 자동 저장은 금지입니다.
- Custom Flow 도구 팔레트의 `CAD 선택 문자 순번 변경` 노드는 `cad.renumber_selected_text`를 호출합니다. 기본 설정은 미리보기이며, 실제 수정은 노드 설정에서 `실제 도면에 적용`과 `적용 확인`을 모두 켠 경우에만 브리지로 전달됩니다. 결과 미리보기는 `기존 문자`, `변경 문자`, `적용 여부` 표로 표시됩니다.
- CAD 툴 페이지용 MD 파일 `tools/CAD_선택_문자_순번_변경_1.0.0.md`도 같은 명령을 사용합니다. 이 툴은 `미리보기`/`적용` action을 분리하며, 적용은 미리보기 이후 확인을 요구합니다.
- AutoCAD 자동 검증에서 외부 PowerShell이 만든 named/Pickfirst selection은 별도 MCP 브리지 프로세스의 현재 선택으로 전달되지 않았습니다. 이 경우 `selectionRequired`로 안전하게 실패합니다. 실제 `cad.renumber_selected_text` 적용 검증은 AutoCAD 화면에서 사용자가 TEXT/MTEXT를 직접 선택한 뒤 미리보기부터 실행해야 합니다.
- `cad.renumber_selected_text`는 이제 `handles` 파라미터도 받습니다. `handles`가 있으면 현재 선택 상태 대신 AutoCAD `HandleToObject()`로 해당 객체를 직접 찾아 처리합니다. Custom Flow의 `CAD 선택 문자 순번 변경` 노드는 이전 CAD 읽기 노드 결과의 `rows[].handle`을 자동으로 추출해 넘깁니다.
- 최신 release exe 기준 Revit `revit.list_levels` -> Excel `excel.write_table` 흐름은 실제 모델 레벨 3개를 새 xlsx 3행/3열로 저장하는 것까지 확인했습니다.
- AI Program 앱 실행 기준은 MCP bridge 직접 호출입니다. Codex CLI 연결은 `/등록` 자동화나 Codex 채팅에서 MCP를 직접 쓰는 보조 경로로 유지하고, 앱 버튼 실행의 필수 조건으로 보지 않습니다.
- AutoCAD가 실행 중이 아니거나 COM 연결이 불가능하면 브리지는 가짜 성공을 반환하지 않고 `ok:false`, `connectedToProgram:false`로 실패를 반환합니다. 이 실패는 툴 실행 단계 완료로 처리하면 안 됩니다.
- 브리지 HTTP 파서는 JSON-RPC `tools/call` POST body를 `Content-Length` 기준으로 끝까지 읽어야 합니다. 이 처리가 빠지면 `/tools/{command}`는 동작하지만 `/mcp` JSON-RPC 호출에서 command가 빈 값으로 들어가는 문제가 재발합니다.
- MD `mcpCommands[].runtimeAction`은 `preview`/`apply` 같은 실행 단계 필터입니다. `buildToolExecutionRequest`는 현재 runtime action과 맞는 명령만 보내므로, 미리보기에서 `open_dwg`/쓰기 명령이 먼저 호출되지 않게 유지해야 합니다.
- 삭제한 GitHub 원본 툴은 localStorage tombstone(`mcp-registry:deleted-github-tool-paths`)으로 다시 표시되지 않게 막습니다. 단, 원격 저장소에서 실제 파일 삭제가 실패하면 다른 컴퓨터에서는 해당 파일이 다시 보일 수 있으므로, 장기적으로는 관리자 삭제 PR/commit 흐름이 필요합니다.
- Electron main과 보안 경로 검증 파일에 깨진 한글 문자열이 재발하지 않도록, 큰 수정 뒤에는 `rg -n '쨌|�|濡|寃|뚯|젣|꾩|媛|鍮|紐|醫|愼' packages/desktop/electron/main.ts packages/desktop/src packages/core/src packages/shared/src`를 확인하세요.
- GitHub 로그인 scope는 `read:user repo`입니다. 기존 `public_repo` 토큰으로 로그인된 상태에서 툴 등록이 `git/refs` 404로 실패하면 앱에서 로그아웃 후 다시 GitHub 로그인을 해야 합니다.
- GitHub 원격 삭제는 직접 삭제가 막히면 삭제 PR을 생성합니다. 삭제한 툴은 현재 PC에서는 tombstone으로 즉시 숨겨지지만, 다른 PC에서 안 보이려면 PR이 머지되어야 합니다.
- 툴 MD의 `learningLog` frontmatter는 `/save`/`/make` 사용 경험 개선용 메타데이터입니다. 앱 실행 로직은 이 값을 사용하지 않아야 하며, 사용자가 막힌 지점, 제시된 선택지, 실제 선택, 추후 개선점을 익명 요약으로만 기록합니다.
- `mcp-tool-builder`와 `save-tool` 번들 스킬은 UTF-8 한글 기준으로 다시 정리되어 있습니다. `/make`/`/save`는 스무고개식 질문 -> 전체 사양 승인 -> HTML 설정창 목업 승인 -> MD 생성 순서를 기준으로 합니다.
- 스킬 설치 IPC는 번들 `SKILL.md`와 참고 MD에 깨진 인코딩 패턴이 있으면 설치를 막습니다. 로컬 `C:\Users\DONG KIM\.codex\skills`에 오래된 깨진 스킬이 남아 있으면 앱에서 스킬 설치 버튼을 다시 누르거나 번들 스킬을 복사해 갱신하세요.
- `packages/desktop/src/toolRuntimeValidation.ts`는 이제 MD schema의 교차참조를 강하게 검사합니다. 중복 설정/액션/단계 ID, 없는 `actionId`, 없는 섹션, 없는 `settings.*` MCP 파라미터, requiredServers 누락, 하나뿐인 select 설정, 위험 action의 preview/confirm 부족, 출력/testCases 누락은 등록/설정창 검증에서 표시됩니다.
- `toolExecutionFailureMessage`는 `raw.mcp`로 감싸진 MCP 응답까지 검사합니다. MCP 브리지가 `ok:false`, `success:false`, `errors`, `failures`, `issues severity=error` 같은 구조를 반환하면 실행 단계가 완료로 넘어가지 않아야 합니다.
- 저장한 설정 프리셋은 실제 설정값이 현재 값과 같을 때 선택 상태로 표시됩니다. Custom Flow 노드는 노드 ID와 실제 툴 ID를 함께 조회해 일반 툴 페이지에서 저장한 설정도 불러올 수 있어야 합니다.
- 설정 프리셋은 중첩 배열/객체까지 깊은 복사로 저장해야 합니다. DWG 목록, 행 순서, 매핑표처럼 사용자가 저장 시점에 만든 설정은 저장 뒤 화면에서 바뀌어도 저장본이 같이 변하면 안 됩니다.
- 툴 페이지, Player view, Custom Flow 노드의 설정 프리셋 UI 기준은 동일합니다. 설정 헤더 오른쪽에 `저장` split 버튼, 화살표의 `다른 이름으로 저장`, `불러오기` 버튼을 두고, 저장본 선택/이름 변경/삭제는 불러오기 dialog에서 처리합니다.
- MD action 라벨이 무엇이든 앱 버튼은 기본적으로 `미리보기`, `실행`으로 표시합니다. 위험도/필요 MCP 요약은 설정 입력칸이 아니라 작동 원리 영역에 표시하고, 도곽 후보가 필요한 도구는 미리보기 뒤 후보 선택 단계를 노출해야 합니다.
- Player view 창 기준은 560x780, 최소 폭은 520입니다. 좁은 창에서 설정 패널이 잘리면 컨텐츠를 잘라내기보다 Player view 기준 폭을 재검토하세요.
- Custom Flow 내 플로우 카드의 이름/설명은 평소 읽기 전용 텍스트로 표시하고, 연필 아이콘을 눌렀을 때만 편집 입력칸을 보여주는 기준입니다.


### Revit MCP bridge port guard

Revit add-in startup is now guarded against `127.0.0.1:5101` port conflicts. If another Revit/HTTP.sys listener still owns the port, the add-in no longer fails Revit startup; it keeps the ribbon command available and reports the port conflict through the status button. Current installed Revit 2025 manifest points to `%APPDATA%\AI Program\RevitMcpBridge\20260709-port-guard\RevitMcpBridge.dll`.

When editing UTF-8 Korean TypeScript files, avoid Windows PowerShell 5 `Get-Content` + `Set-Content` round trips. Use Node `fs.readFileSync(..., "utf8")` / `writeFileSync(..., "utf8")` or `apply_patch` from a writable workspace to avoid mojibake.

### Revit MCP port

AI Program Revit MCP now uses `http://127.0.0.1:5101/mcp`. Port `5001` conflicted with another Revit HTTP.sys listener on this machine, so app defaults, Codex MCP config, and the Revit add-in source were moved to `5101`. If Revit shows a startup conflict, verify that the installed manifest points to `%APPDATA%\AI Program\RevitMcpBridge\20260709-port-5101\RevitMcpBridge.dll`.

Revit busy/blocked timeout handling now returns `code: revitBusyOrBlocked` with an ESC instruction. The installed Revit 2025 manifest has been updated to `C:\CodexProjects\AI_PROGRAM\tools\mcp-bridges\revit-addin-bridge\bin\Release\RevitMcpBridge.dll`; restart Revit before validating the new message in the add-in.

Custom Flow execution now has shared reliability notices. If an MCP command runs longer than 8 seconds, the run timeline explains that a large file, an external program command state, or MCP server delay may be the cause. Common failures such as Revit busy, MCP connection refused, generic timeout, and empty upstream result are normalized through `toolExecutionRecoveryMessage` before they are shown to the user.
