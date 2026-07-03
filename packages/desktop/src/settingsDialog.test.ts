import { describe, expect, it } from "vitest";
import { settingsSections } from "./settingsDialog";

describe("settingsSections", () => {
  it("starts with MCP server controls and then display mode controls", () => {
    expect(settingsSections.map((section) => section.id)).toEqual(["servers", "display"]);
    expect(settingsSections.map((section) => section.label)).toEqual(["MCP 서버", "화면 모드"]);
  });
});
