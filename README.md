# MCP Registry Desktop

CAD와 Revit의 MCP 연결 정보를 한곳에서 관리하기 위한 Windows 데스크톱 앱입니다.

현재 버전은 실제 CAD/Revit 자동화 실행보다, 연결 정보를 등록하고 상태를 확인할 수 있는 기반을 마련하는 데 초점을 둡니다.

## 현재 기능

- CAD MCP 연결 정보 표시
- Revit MCP 연결 정보 표시
- MCP 서버 목록과 선택한 서버 상세 정보 표시
- CAD/Revit/Workflow 관점의 작업 탭 제공
- Process Monitor, Excel, Tekla 확장 영역의 기본 화면 제공
- 개발용 연결 목록을 `data/registry.json`에 저장

## 실행

```powershell
pnpm install
pnpm dev
```

개발 서버 기본 주소는 다음과 같습니다.

```text
http://127.0.0.1:5173/
```

## 확인 명령

```powershell
pnpm test
pnpm typecheck
pnpm build
```

## 프로젝트 구조

```text
packages/shared   공통 타입 정의
packages/core     MCP 연결 저장, 검증, 상태 확인 로직
packages/desktop  Electron + React 데스크톱 화면
data              개발용 registry JSON 데이터
docs              설계 및 구현 계획 문서
```

## 다음 단계

- 앱 화면에 남아 있는 깨진 한글 문자열 복구
- 서버 추가, 수정, 삭제 버튼의 실제 동작 연결
- CAD/Revit MCP bridge 실행, 중지, 상태 새로고침 기능 연결
- 실제 사용자 환경에서는 registry 저장 위치를 Windows 사용자 데이터 폴더로 이동
