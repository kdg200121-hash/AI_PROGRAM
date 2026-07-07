export type SidebarSectionId =
  | "home"
  | "servers"
  | "revit"
  | "workflow"
  | "monitor"
  | "excel"
  | "tekla";

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

export interface DefaultSubmenuItem {
  id: string;
  label: string;
  description: string;
}

export const sidebarSections: SidebarSection[] = [
  { id: "servers", label: "CAD", shortLabel: "C" },
  { id: "revit", label: "Revit", shortLabel: "R" },
  { id: "workflow", label: "Custom Flow", shortLabel: "F" },
  { id: "excel", label: "Excel", shortLabel: "E" },
  { id: "tekla", label: "Tekla", shortLabel: "T" }
];

export const overviewCards: OverviewCard[] = [
  {
    title: "최근 연결 로그",
    body: "MCP 연결 확인 결과와 실행 기록을 이 영역에 표시합니다."
  },
  {
    title: "다음 작업 대기",
    body: "수집한 정보가 다음 작업으로 이어질 수 있도록 대기 목록을 보여줍니다."
  },
  {
    title: "변환 준비 상태",
    body: "레이어, 블록, 좌표, 패밀리 매핑 상태를 한눈에 확인합니다."
  }
];

const sharedToolSubmenus: DefaultSubmenuItem[] = [
  {
    id: "tools",
    label: "Share Tools",
    description: "모든 사용자에게 기본으로 제공되는 공용 MCP 툴을 정리합니다."
  },
  {
    id: "settings",
    label: "Custom Tools",
    description: "MD 파일 기반 커스텀 툴을 가져오고 상단고정으로 관리합니다."
  }
];

const workflowSubmenus: DefaultSubmenuItem[] = [
  { id: "add", label: "+", description: "새 Custom Flow 캔버스를 엽니다." }
];

export function shouldShowSubmenuAddButton(sectionId: SidebarSectionId) {
  return sectionId === "workflow";
}

export function getDefaultSubmenuItemsForSection(sectionId: SidebarSectionId) {
  return sectionId === "workflow" ? workflowSubmenus : [];
}

export const workflowSteps: WorkflowStep[] = [
  {
    title: "툴 선택",
    body: "왼쪽 메뉴의 페이지 안에서 사용할 MCP 툴을 플로우에 추가합니다."
  },
  {
    title: "노드 연결",
    body: "각 툴의 입력값과 결과값을 포트로 연결해 원하는 작업 흐름을 만듭니다."
  },
  {
    title: "자동 실행",
    body: "검토가 끝난 플로우를 순서대로 실행해 CAD, Revit, Excel 작업을 이어갑니다."
  }
];
