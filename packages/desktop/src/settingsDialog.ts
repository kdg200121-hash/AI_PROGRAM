export type SettingsSectionId = "servers" | "display";
export type ColorMode = "light" | "dark";

export interface SettingsSection {
  id: SettingsSectionId;
  label: string;
}

export const settingsSections: SettingsSection[] = [
  { id: "servers", label: "MCP 서버" },
  { id: "display", label: "화면 모드" }
];

export interface ColorModeOption {
  id: ColorMode;
  label: string;
  description: string;
}

export const colorModeOptions: ColorModeOption[] = [
  {
    id: "light",
    label: "일반모드",
    description: "밝은 배경으로 기본 작업 화면을 사용합니다."
  },
  {
    id: "dark",
    label: "다크모드",
    description: "어두운 배경으로 눈부심을 줄여 작업합니다."
  }
];
