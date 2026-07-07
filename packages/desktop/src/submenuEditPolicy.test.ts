import { describe, expect, it } from "vitest";
import { canEditSubmenuHeader } from "./submenuEditPolicy";

describe("canEditSubmenuHeader", () => {
  it("allows Custom Flow submenu headers to stay editable", () => {
    expect(canEditSubmenuHeader({ sectionId: "workflow", submenuId: "cad-to-revit" })).toBe(true);
  });

  it("prevents Share Tools and Custom Tools headers from being edited outside Custom Flow", () => {
    expect(canEditSubmenuHeader({ sectionId: "cad", submenuId: "tools" })).toBe(false);
    expect(canEditSubmenuHeader({ sectionId: "cad", submenuId: "settings" })).toBe(false);
    expect(canEditSubmenuHeader({ sectionId: "cad", submenuId: "share-read-cad" })).toBe(false);
    expect(canEditSubmenuHeader({ sectionId: "cad", submenuId: "custom-tool-local-1" })).toBe(false);
  });

  it("prevents normal user-created submenu headers from being edited outside Custom Flow", () => {
    expect(canEditSubmenuHeader({ sectionId: "cad", submenuId: "cad-layer-tools" })).toBe(false);
  });
});
