import { describe, expect, it } from "vitest";
import { colorModeOptions, settingsSections } from "./settingsDialog";

describe("settingsSections", () => {
  it("starts with MCP server controls and then display mode controls", () => {
    expect(settingsSections.map((section) => section.id)).toEqual(["servers", "display"]);
    expect(settingsSections.map((section) => section.label)).toEqual(["MCP 서버", "화면 모드"]);
  });

  it("offers normal mode and dark mode as display modes", () => {
    expect(colorModeOptions.map((option) => option.id)).toEqual(["light", "dark"]);
    expect(colorModeOptions.map((option) => option.label)).toEqual(["일반 모드", "다크 모드"]);
  });
});
