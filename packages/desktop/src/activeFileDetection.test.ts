import { describe, expect, it } from "vitest";
import {
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
});
