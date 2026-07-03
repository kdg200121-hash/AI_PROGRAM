export type SettingsSectionId = "servers" | "display";

export interface SettingsSection {
  id: SettingsSectionId;
  label: string;
}

export const settingsSections: SettingsSection[] = [
  { id: "servers", label: "MCP 서버" },
  { id: "display", label: "화면 모드" }
];
