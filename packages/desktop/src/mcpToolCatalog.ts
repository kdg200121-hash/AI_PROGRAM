import type { WorkspaceTabId } from "./workspaceTabs";

export interface McpToolPreview {
  name: string;
  description: string;
}

const toolCatalog: Record<WorkspaceTabId, McpToolPreview[]> = {
  registry: [
    { name: "서버 등록", description: "CAD/Revit MCP 서버 정보를 저장합니다." },
    { name: "상태 확인", description: "등록된 MCP 서버의 연결 상태를 확인합니다." },
    { name: "프로필 관리", description: "Codex, Claude에서 사용할 연결 구성을 준비합니다." }
  ],
  cad: [
    { name: "도면 객체 읽기", description: "선, 문자, 블록 같은 CAD 객체를 읽습니다." },
    { name: "레이어 정보 추출", description: "레이어 이름, 색상, 사용 객체를 정리합니다." },
    { name: "블록 위치 수집", description: "블록 기준점과 배치 좌표를 수집합니다." }
  ],
  revit: [
    { name: "요소 생성", description: "Revit 모델 요소를 생성하는 명령을 준비합니다." },
    { name: "패밀리 배치", description: "CAD에서 읽은 위치를 기준으로 패밀리를 배치합니다." },
    { name: "파라미터 업데이트", description: "선택 요소의 파라미터 값을 수정합니다." }
  ],
  workflow: [
    { name: "CAD 정보 변환", description: "CAD 데이터를 Revit 작업용 데이터로 바꿉니다." },
    { name: "Revit 실행 큐", description: "변환된 작업을 순서대로 Revit에 전달합니다." },
    { name: "동기화 결과 확인", description: "CAD와 Revit 사이 처리 결과를 비교합니다." }
  ]
};

export function getToolsForWorkspace(tabId: WorkspaceTabId): McpToolPreview[] {
  return toolCatalog[tabId];
}
