import { describe, expect, it } from "vitest";
import {
  canAutoPersistCustomFlowGraph,
  canSaveCustomFlowFromShortcut,
  isSaveShortcut
} from "./customFlowShortcut";

describe("customFlowShortcut", () => {
  it("detects Ctrl+S and Meta+S as save shortcuts", () => {
    expect(isSaveShortcut({ key: "s", ctrlKey: true, metaKey: false })).toBe(true);
    expect(isSaveShortcut({ key: "S", ctrlKey: false, metaKey: true })).toBe(true);
  });

  it("ignores unrelated shortcuts", () => {
    expect(isSaveShortcut({ key: "f", ctrlKey: true, metaKey: false })).toBe(false);
    expect(isSaveShortcut({ key: "s", ctrlKey: false, metaKey: false })).toBe(false);
  });

  it("allows Ctrl+S only while the Custom Flow canvas editor is open", () => {
    expect(
      canSaveCustomFlowFromShortcut({
        key: "s",
        ctrlKey: true,
        metaKey: false,
        workflowMode: "editor"
      })
    ).toBe(true);
    expect(
      canSaveCustomFlowFromShortcut({
        key: "s",
        ctrlKey: true,
        metaKey: false,
        workflowMode: "home"
      })
    ).toBe(false);
  });

  it("auto persists the graph only while the canvas editor is open", () => {
    expect(canAutoPersistCustomFlowGraph("editor")).toBe(true);
    expect(canAutoPersistCustomFlowGraph("home")).toBe(false);
  });
});
