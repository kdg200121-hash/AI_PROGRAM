import { describe, expect, it } from "vitest";
import {
  activeFileProgramForTarget,
  activeFileProbeUrls,
  extractDetectedActiveFiles
} from "./activeFileDetection";

describe("activeFileDetection", () => {
  it("extracts a CAD active file from common bridge status payloads", () => {
    expect(
      extractDetectedActiveFiles(
        {
          activeFile: {
            name: "평택 1층 평면.dwg",
            path: "C:/project/평택 1층 평면.dwg"
          }
        },
        "cad",
        "server-cad"
      )
    ).toEqual([
      {
        id: "active-cad",
        label: "평택 1층 평면.dwg",
        program: "cad",
        path: "C:/project/평택 1층 평면.dwg"
      }
    ]);
  });

  it("builds active-file probe urls near the MCP endpoint", () => {
    expect(activeFileProbeUrls("http://localhost:5100/mcp")).toContain(
      "http://localhost:5100/active-file"
    );
    expect(activeFileProbeUrls("http://localhost:5100/mcp")).toContain(
      "http://localhost:5100/mcp/active-file"
    );
  });

  it("maps MCP server targets that can report active files", () => {
    expect(activeFileProgramForTarget("cad")).toBe("cad");
    expect(activeFileProgramForTarget("revit")).toBe("revit");
    expect(activeFileProgramForTarget("excel")).toBe("excel");
    expect(activeFileProgramForTarget("other")).toBeNull();
  });

  it("extracts Excel workbook payloads from the bridge active-file response", () => {
    expect(
      extractDetectedActiveFiles(
        {
          workbook: {
            name: "schedule.xlsx",
            fullName: "C:/project/schedule.xlsx"
          }
        },
        "excel",
        "server-excel"
      )
    ).toEqual([
      {
        id: "active-excel",
        label: "schedule.xlsx",
        program: "excel",
        path: "C:/project/schedule.xlsx"
      }
    ]);
  });
});
