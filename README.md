# MCP Registry Desktop

CAD와 Revit의 MCP 연결 정보를 한 곳에서 관리하는 Windows 데스크톱 앱입니다.

## 첫 버전에서 되는 일

- CAD 연결 정보를 보여줍니다.
- Revit 연결 정보를 보여줍니다.
- 연결 목록에서 항목을 선택하면 상세 정보를 보여줍니다.
- CAD에서 정보를 읽어 Revit에서 실행하는 기능을 나중에 붙일 수 있는 자리를 제공합니다.

## 실행

```bash
pnpm install
pnpm dev
```

개발 화면은 기본적으로 아래 주소에서 열립니다.

```text
http://127.0.0.1:5173/
```

## 테스트

```bash
pnpm test
pnpm typecheck
pnpm build
```

## 저장 위치

개발 중에는 `data/registry.json`을 사용합니다.
실사용 버전에서는 Windows 사용자 앱 데이터 폴더로 옮길 예정입니다.

## 현재 단계

현재는 첫 화면과 핵심 저장/검증/포트 상태 확인 로직이 준비된 상태입니다.
다음 단계에서는 실제 추가/수정/삭제 버튼 동작과 CAD/Revit 연결 실행 기능을 붙입니다.
