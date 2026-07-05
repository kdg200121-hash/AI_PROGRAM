# MCP Registry Desktop

CAD와 Revit의 MCP 연결 정보를 관리하기 위한 Windows 데스크톱 프로그램입니다.

기본 실행 대상은 Electron 프로그램 창입니다. React 화면은 프로그램 창 안에서 렌더링되며, 웹 브라우저 미리보기는 개발 보조 용도로만 분리해 둡니다.

## 현재 기능

- CAD/Revit MCP 서버 목록 표시
- 서버 추가, 수정, 삭제
- `data/registry.json` 기반 서버 정보 저장
- 작업공간 탭, 좌측 메뉴, 즐겨찾기, 최근 사용 소메뉴
- Settings, Process Monitor 화면 영역
- 라이트/다크 화면 모드

## 실행

프로그램 창으로 실행합니다.

```powershell
pnpm install
pnpm dev
```

## exe 만들기

다른 사람에게 전달할 포터블 실행 폴더를 만듭니다.

```powershell
pnpm package:win
```

생성 위치는 다음입니다.

```text
release/AI_PROGRAM-win32-x64/AI_PROGRAM.exe
```

`AI_PROGRAM.exe`만 단독으로 보내면 안 되고, `AI_PROGRAM-win32-x64` 폴더 전체를 전달해야 합니다.

웹 브라우저에서만 미리보고 싶을 때는 별도 명령을 사용합니다.

```powershell
pnpm dev:web
```

웹 미리보기 기본 주소는 다음입니다.

```text
http://127.0.0.1:5173/
```

## 확인 명령

```powershell
pnpm test
pnpm typecheck
pnpm build
```

`pnpm build`는 Electron main/preload 산출물과 웹 렌더러 산출물을 모두 만듭니다.

```text
packages/desktop/dist-electron  Electron main/preload
packages/desktop/dist           React renderer
```

배포된 프로그램의 서버 설정은 각 사용자 Windows 데이터 폴더에 저장됩니다.

```text
%APPDATA%/ai-program/registry.json
```

## 프로젝트 구조

```text
packages/shared   공통 타입 정의
packages/core     MCP 연결 저장소, 검증, 상태 확인 로직
packages/desktop  Electron + React 데스크톱 프로그램
data              개발용 registry JSON 데이터
docs              설계 및 구현 계획 문서
```

## 다음 단계

- 실행/중지 버튼을 실제 프로세스 관리 기능과 연결
- Process Monitor에 실행 로그와 상태 갱신 연결
- MCP 서버 연결 상태 확인을 실제 포트/URL 점검으로 확장
- 실제 사용자 환경에서는 registry 저장 위치를 Windows 사용자 데이터 폴더로 이동
