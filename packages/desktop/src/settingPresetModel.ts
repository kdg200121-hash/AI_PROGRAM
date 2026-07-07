import type { ToolSettingValue } from "./toolSettingsSchema";

export const settingPresetsStorageKey = "mcp-registry:tool-setting-presets";

export interface SettingPreset {
  id: string;
  toolId: string;
  name: string;
  values: Record<string, ToolSettingValue>;
  createdAt: number;
  updatedAt: number;
}

export function cloneSettingValues(
  values: Record<string, ToolSettingValue>
): Record<string, ToolSettingValue> {
  return JSON.parse(JSON.stringify(values)) as Record<string, ToolSettingValue>;
}

export function createSettingPreset(
  toolId: string,
  name: string,
  values: Record<string, ToolSettingValue>,
  now = Date.now()
): SettingPreset {
  return {
    id: `preset-${now}-${Math.random().toString(36).slice(2, 8)}`,
    toolId,
    name: name.trim() || "저장한 설정",
    values: cloneSettingValues(values),
    createdAt: now,
    updatedAt: now
  };
}

export function listSettingPresetsForTool(presets: SettingPreset[], toolId: string) {
  return presets
    .filter((preset) => preset.toolId === toolId)
    .sort((left, right) => right.updatedAt - left.updatedAt);
}

export function upsertSettingPreset(
  presets: SettingPreset[],
  preset: SettingPreset,
  now = Date.now()
) {
  const existing = presets.find((item) => item.id === preset.id);
  const nextPreset: SettingPreset = {
    ...preset,
    values: cloneSettingValues(preset.values),
    createdAt: existing?.createdAt ?? preset.createdAt,
    updatedAt: now
  };

  return [nextPreset, ...presets.filter((item) => item.id !== preset.id)];
}

export function removeSettingPreset(presets: SettingPreset[], presetId: string) {
  return presets.filter((preset) => preset.id !== presetId);
}

export function renameSettingPreset(
  presets: SettingPreset[],
  presetId: string,
  name: string,
  now = Date.now()
) {
  const nextName = name.trim() || "저장한 설정";
  return presets.map((preset) =>
    preset.id === presetId
      ? {
          ...preset,
          name: nextName,
          updatedAt: now
        }
      : preset
  );
}

export function loadSettingPresets(storage: Storage = window.localStorage): SettingPreset[] {
  try {
    const raw = storage.getItem(settingPresetsStorageKey);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item): SettingPreset | null => {
        if (!item || typeof item !== "object") {
          return null;
        }
        return {
          id: String(item.id ?? ""),
          toolId: String(item.toolId ?? ""),
          name: String(item.name ?? "저장한 설정"),
          values:
            item.values && typeof item.values === "object" && !Array.isArray(item.values)
              ? cloneSettingValues(item.values as Record<string, ToolSettingValue>)
              : {},
          createdAt: Number(item.createdAt ?? Date.now()),
          updatedAt: Number(item.updatedAt ?? item.createdAt ?? Date.now())
        };
      })
      .filter((item): item is SettingPreset => Boolean(item?.id && item.toolId));
  } catch {
    return [];
  }
}

export function saveSettingPresets(
  presets: SettingPreset[],
  storage: Storage = window.localStorage
) {
  storage.setItem(settingPresetsStorageKey, JSON.stringify(presets));
}
