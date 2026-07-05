import type { SidebarSectionId } from "./navigationModel";
import { sidebarSections } from "./navigationModel";
import type { WorkspaceTabId } from "./workspaceTabs";

export type TabSidebarSource = "menu" | "favorite" | "submenu" | "favoriteSubmenu" | "recent";

export interface AppTab {
  id: string;
  title: string;
  sectionId: SidebarSectionId;
  workspaceTabId: WorkspaceTabId;
  isPinned: boolean;
  sidebarSource: TabSidebarSource;
  submenuKey: string | null;
}

export function createBlankTab(id: string): AppTab {
  return {
    id,
    title: "Home",
    sectionId: "home",
    workspaceTabId: "cad",
    isPinned: false,
    sidebarSource: "menu",
    submenuKey: null
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
    isPinned: false,
    sidebarSource: "menu",
    submenuKey: null
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

export type TabDropPosition = "before" | "after";

export function moveTab(
  tabs: AppTab[],
  draggedTabId: string,
  targetTabId: string,
  position: TabDropPosition = "before"
): AppTab[] {
  if (draggedTabId === targetTabId) {
    return tabs;
  }

  const draggedIndex = tabs.findIndex((tab) => tab.id === draggedTabId);
  const targetIndex = tabs.findIndex((tab) => tab.id === targetTabId);

  if (draggedIndex === -1 || targetIndex === -1) {
    return tabs;
  }

  const nextTabs = [...tabs];
  const [draggedTab] = nextTabs.splice(draggedIndex, 1);
  const nextTargetIndex = nextTabs.findIndex((tab) => tab.id === targetTabId);
  const insertionIndex = position === "after" ? nextTargetIndex + 1 : nextTargetIndex;
  nextTabs.splice(insertionIndex, 0, draggedTab);
  return nextTabs;
}

export function moveTabToEnd(tabs: AppTab[], draggedTabId: string): AppTab[] {
  const draggedIndex = tabs.findIndex((tab) => tab.id === draggedTabId);

  if (draggedIndex === -1 || draggedIndex === tabs.length - 1) {
    return tabs;
  }

  const nextTabs = [...tabs];
  const [draggedTab] = nextTabs.splice(draggedIndex, 1);
  nextTabs.push(draggedTab);
  return nextTabs;
}

function sectionLabel(sectionId: SidebarSectionId) {
  if (sectionId === "home") {
    return "Home";
  }

  if (sectionId === "monitor") {
    return "Process Monitor";
  }

  return sidebarSections.find((section) => section.id === sectionId)?.label ?? "새 탭";
}
