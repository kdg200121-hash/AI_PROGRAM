import { describe, expect, it } from "vitest";
import {
  cloneSettingValues,
  createSettingPreset,
  listSettingPresetsForTool,
  removeSettingPreset,
  renameSettingPreset,
  upsertSettingPreset,
  type SettingPreset
} from "./settingPresetModel";

describe("settingPresetModel", () => {
  it("stores presets per tool and keeps the newest preset first", () => {
    const first = createSettingPreset("cad-read", "CAD default", { scope: "selection" }, 100);
    const second = createSettingPreset("excel-export", "Excel report", { export_path: "ask_on_run" }, 200);
    const third = createSettingPreset("cad-read", "CAD drawing", { scope: "drawing" }, 300);

    const presets = [first, second, third];

    expect(listSettingPresetsForTool(presets, "cad-read").map((preset) => preset.name)).toEqual([
      "CAD drawing",
      "CAD default"
    ]);
  });

  it("updates an existing preset without changing its created date", () => {
    const existing: SettingPreset = {
      id: "preset-1",
      toolId: "cad-read",
      name: "CAD default",
      values: { scope: "selection" },
      createdAt: 100,
      updatedAt: 100
    };

    const presets = upsertSettingPreset(
      [existing],
      { ...existing, name: "CAD selected objects", values: { scope: "selected" }, updatedAt: 500 },
      500
    );

    expect(presets).toEqual([
      {
        id: "preset-1",
        toolId: "cad-read",
        name: "CAD selected objects",
        values: { scope: "selected" },
        createdAt: 100,
        updatedAt: 500
      }
    ]);
  });

  it("renames presets by id", () => {
    const preset = createSettingPreset("cad-read", "old name", { scope: "selection" }, 100);

    expect(renameSettingPreset([preset], preset.id, "new name", 300)).toEqual([
      {
        ...preset,
        name: "new name",
        updatedAt: 300
      }
    ]);
  });

  it("removes presets by id", () => {
    const first = createSettingPreset("cad-read", "CAD default", {}, 100);
    const second = createSettingPreset("cad-read", "CAD drawing", {}, 200);

    expect(removeSettingPreset([first, second], first.id)).toEqual([second]);
  });

  it("keeps a full snapshot of nested list settings at save time", () => {
    const values = {
      dwg_files: [
        { file_path: "A.dwg", title_block_count: 2 },
        { file_path: "B.dwg", title_block_count: 3 }
      ],
      mapping: [{ source: "Layer", target: "Sheet" }]
    };

    const preset = createSettingPreset("cad-numbering", "saved order", values, 100);
    values.dwg_files.reverse();
    values.dwg_files[0].file_path = "changed.dwg";
    values.mapping[0].target = "Changed";

    expect(preset.values).toEqual({
      dwg_files: [
        { file_path: "A.dwg", title_block_count: 2 },
        { file_path: "B.dwg", title_block_count: 3 }
      ],
      mapping: [{ source: "Layer", target: "Sheet" }]
    });
  });

  it("clones loaded preset values before putting them into editable state", () => {
    const values = {
      dwg_files: [
        { file_path: "A.dwg", title_block_count: 2 },
        { file_path: "B.dwg", title_block_count: 3 }
      ]
    };
    const cloned = cloneSettingValues(values);

    values.dwg_files[0].file_path = "changed.dwg";

    expect(cloned).toEqual({
      dwg_files: [
        { file_path: "A.dwg", title_block_count: 2 },
        { file_path: "B.dwg", title_block_count: 3 }
      ]
    });
  });
});
