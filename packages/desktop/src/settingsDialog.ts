export type SettingsSectionId = "servers" | "ai" | "display" | "account" | "management";
export type ColorMode = "light" | "dark";

export interface SettingsSection {
  id: SettingsSectionId;
  label: string;
}

export const settingsSections: SettingsSection[] = [
  { id: "servers", label: "MCP 서버" },
  { id: "ai", label: "AI 연결" },
  { id: "display", label: "화면 모드" },
  { id: "account", label: "계정 정보" },
  { id: "management", label: "관리" }
];

export interface ColorModeOption {
  id: ColorMode;
  label: string;
  description: string;
}

export const colorModeOptions: ColorModeOption[] = [
  {
    id: "light",
    label: "일반 모드",
    description: "밝은 배경으로 기본 작업 화면을 사용합니다."
  },
  {
    id: "dark",
    label: "다크 모드",
    description: "어두운 배경으로 눈부심을 줄여 작업합니다."
  }
];
