import { describe, expect, it } from "vitest";
import {
  closeTab,
  createBlankTab,
  createSectionTab,
  duplicateTab,
  getPinnedTabs,
  moveTab,
  togglePinnedTab
} from "./tabModel";

describe("tabModel", () => {
  it("creates a blank tab from the plus button", () => {
    const tab = createBlankTab("tab-1");

    expect(tab.title).toBe("새 탭");
    expect(tab.sectionId).toBe("servers");
    expect(tab.workspaceTabId).toBe("cad");
  });

  it("opens a sidebar section in a new tab", () => {
    const tab = createSectionTab("tab-2", "workflow", "revit");

    expect(tab.title).toBe("CAD ↔ Revit");
    expect(tab.sectionId).toBe("workflow");
    expect(tab.workspaceTabId).toBe("revit");
  });

  it("duplicates and pins tabs", () => {
    const tab = createSectionTab("tab-3", "monitor", "cad");
    const duplicated = duplicateTab(tab, "tab-4");
    const pinned = togglePinnedTab(duplicated);

    expect(duplicated.title).toBe("Process Monitor 복사본");
    expect(pinned.isPinned).toBe(true);
  });

  it("returns pinned tabs for startup restore", () => {
    const tabs = [
      createSectionTab("tab-5", "servers", "cad"),
      togglePinnedTab(createSectionTab("tab-6", "monitor", "cad"))
    ];

    expect(getPinnedTabs(tabs).map((tab) => tab.id)).toEqual(["tab-6"]);
  });

  it("keeps one tab open when closing tabs", () => {
    const onlyTab = createBlankTab("tab-7");

    expect(closeTab([onlyTab], onlyTab.id)).toEqual([onlyTab]);
    expect(closeTab([onlyTab, createBlankTab("tab-8")], onlyTab.id).map((tab) => tab.id)).toEqual([
      "tab-8"
    ]);
  });

  it("moves a tab to a new position", () => {
    const tabs = [
      createBlankTab("tab-9"),
      createBlankTab("tab-10"),
      createBlankTab("tab-11")
    ];

    expect(moveTab(tabs, "tab-11", "tab-9").map((tab) => tab.id)).toEqual([
      "tab-11",
      "tab-9",
      "tab-10"
    ]);
  });
});
