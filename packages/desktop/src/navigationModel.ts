export type SidebarSectionId = "servers" | "workflow" | "monitor" | "excel" | "tekla";

export interface SidebarSection {
  id: SidebarSectionId;
  label: string;
  shortLabel: string;
}

export interface OverviewCard {
  title: string;
  body: string;
}

export interface WorkflowStep {
  title: string;
  body: string;
}

export const sidebarSections: SidebarSection[] = [
  { id: "servers", label: "CAD", shortLabel: "C" },
  { id: "workflow", label: "CAD ↔ Revit", shortLabel: "C" },
  { id: "excel", label: "Excel", shortLabel: "E" },
  { id: "tekla", label: "Tekla", shortLabel: "T" }
];

export const overviewCards: OverviewCard[] = [
  {
    title: "최근 연결 로그",
    body: "CAD/Revit MCP 연결 확인 결과와 실행 기록을 이 영역에 표시합니다."
  },
  {
    title: "다음 작업 큐",
    body: "CAD에서 읽은 정보가 Revit 작업으로 넘어가기 전 대기 목록을 보여줍니다."
  },
  {
    title: "변환 준비 상태",
    body: "레이어, 블록, 좌표, 패밀리 매핑 상태를 한눈에 확인합니다."
  }
];

export const workflowSteps: WorkflowStep[] = [
  {
    title: "CAD 정보 읽기",
    body: "도면의 레이어, 블록, 위치 좌표를 MCP 도구로 수집합니다."
  },
  {
    title: "데이터 변환",
    body: "CAD 정보를 Revit에서 실행 가능한 벽, 장비, 패밀리 작업으로 정리합니다."
  },
  {
    title: "Revit 실행",
    body: "검토된 작업 큐를 Revit MCP Bridge로 보내 모델 작업을 실행합니다."
  }
];
