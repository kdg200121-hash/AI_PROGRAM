import type { SidebarSectionId } from "./navigationModel";
import { sidebarSections } from "./navigationModel";
import type { WorkspaceTabId } from "./workspaceTabs";

export interface AppTab {
  id: string;
  title: string;
  sectionId: SidebarSectionId;
  workspaceTabId: WorkspaceTabId;
  isPinned: boolean;
}

export function createBlankTab(id: string): AppTab {
  return {
    id,
    title: "새 탭",
    sectionId: "servers",
    workspaceTabId: "cad",
    isPinned: false
  };
}

export function createSectionTab(
  id: string,
  sectionId: SidebarSectionId,
  workspaceTabId: WorkspaceTabId
): AppTab {
  return {
    id,
    title: sectionLabel(sectionId),
    sectionId,
    workspaceTabId,
    isPinned: false
  };
}

export function duplicateTab(tab: AppTab, id: string): AppTab {
  return {
    ...tab,
    id,
    title: `${tab.title} 복사본`,
    isPinned: false
  };
}

export function togglePinnedTab(tab: AppTab): AppTab {
  return { ...tab, isPinned: !tab.isPinned };
}

export function getPinnedTabs(tabs: AppTab[]): AppTab[] {
  return tabs.filter((tab) => tab.isPinned);
}

export function closeTab(tabs: AppTab[], tabId: string): AppTab[] {
  if (tabs.length <= 1) {
    return tabs;
  }

  return tabs.filter((tab) => tab.id !== tabId);
}

function sectionLabel(sectionId: SidebarSectionId) {
  return sidebarSections.find((section) => section.id === sectionId)?.label ?? "새 탭";
}
