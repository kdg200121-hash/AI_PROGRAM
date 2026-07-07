import { describe, expect, it } from "vitest";
import {
  createSettingPreset,
  listSettingPresetsForTool,
  removeSettingPreset,
  upsertSettingPreset,
  type SettingPreset
} from "./settingPresetModel";

describe("settingPresetModel", () => {
  it("stores presets per tool and keeps the newest preset first", () => {
    const first = createSettingPreset("cad-read", "CAD 기본값", { scope: "selection" }, 100);
    const second = createSettingPreset("excel-export", "Excel 보고서", { export_path: "ask_on_run" }, 200);
    const third = createSettingPreset("cad-read", "CAD 전체 도면", { scope: "drawing" }, 300);

    const presets = [first, second, third];

    expect(listSettingPresetsForTool(presets, "cad-read").map((preset) => preset.name)).toEqual([
      "CAD 전체 도면",
      "CAD 기본값"
    ]);
  });

  it("updates an existing preset without changing its created date", () => {
    const existing: SettingPreset = {
      id: "preset-1",
      toolId: "cad-read",
      name: "CAD 기본값",
      values: { scope: "selection" },
      createdAt: 100,
      updatedAt: 100
    };

    const presets = upsertSettingPreset(
      [existing],
      { ...existing, name: "CAD 선택 객체", values: { scope: "selected" }, updatedAt: 500 },
      500
    );

    expect(presets).toEqual([
      {
        id: "preset-1",
        toolId: "cad-read",
        name: "CAD 선택 객체",
        values: { scope: "selected" },
        createdAt: 100,
        updatedAt: 500
      }
    ]);
  });

  it("removes presets by id", () => {
    const first = createSettingPreset("cad-read", "CAD 기본값", {}, 100);
    const second = createSettingPreset("cad-read", "CAD 전체 도면", {}, 200);

    expect(removeSettingPreset([first, second], first.id)).toEqual([second]);
  });
});
