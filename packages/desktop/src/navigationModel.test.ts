import { describe, expect, it } from "vitest";
import {
  getDefaultSubmenuItemsForSection,
  overviewCards,
  shouldShowSubmenuAddButton,
  sidebarSections,
  workflowSteps
} from "./navigationModel";

describe("navigationModel", () => {
  it("defines the left navigation as screen sections, not target tabs", () => {
    expect(sidebarSections.map((section) => section.id)).toEqual([
      "servers",
      "revit",
      "workflow",
      "excel",
      "tekla"
    ]);
    expect(sidebarSections.map((section) => section.label)).toEqual([
      "CAD",
      "Revit",
      "Custom Flow",
      "Excel",
      "Tekla"
    ]);
  });

  it("provides operational overview cards for the empty area", () => {
    expect(overviewCards).toHaveLength(3);
  });

  it("documents the custom flow stages", () => {
    expect(workflowSteps).toHaveLength(3);
  });

  it("shows the submenu add button only for Custom Flow", () => {
    expect(shouldShowSubmenuAddButton("workflow")).toBe(true);
    expect(shouldShowSubmenuAddButton("servers")).toBe(false);
    expect(shouldShowSubmenuAddButton("revit")).toBe(false);
    expect(shouldShowSubmenuAddButton("excel")).toBe(false);
    expect(shouldShowSubmenuAddButton("tekla")).toBe(false);
  });

  it("uses only the new canvas action as the default Custom Flow submenu", () => {
    expect(getDefaultSubmenuItemsForSection("workflow").map((item) => item.label)).toEqual([
      "+"
    ]);
    expect(getDefaultSubmenuItemsForSection("servers").map((item) => item.label)).toEqual([]);
    expect(getDefaultSubmenuItemsForSection("revit").map((item) => item.label)).toEqual([]);
    expect(getDefaultSubmenuItemsForSection("excel").map((item) => item.label)).toEqual([]);
    expect(getDefaultSubmenuItemsForSection("tekla").map((item) => item.label)).toEqual([]);
  });
});
