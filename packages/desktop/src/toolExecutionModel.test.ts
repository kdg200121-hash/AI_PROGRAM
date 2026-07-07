import { describe, expect, it } from "vitest";
import {
  buildToolExecutionRequest,
  extractTitleBlockCandidates
} from "./toolExecutionModel";
import type { ToolRuntimeSchema } from "./toolSettingsSchema";

const titleBlockSchema: ToolRuntimeSchema = {
  risk: "bulk-modify",
  executionMode: "hybrid",
  requiredServers: ["cad"],
  mcpCommands: [
    {
      server: "cad",
      command: "cad.titleBlocks.previewRenumber",
      status: "planned",
      params: {
        files: "settings.dwg_files",
        prefix: "settings.number_prefix",
        start: "settings.start_number"
      }
    }
  ],
  preflightChecks: [],
  resultSchema: { type: "table", fields: [] },
  failurePolicy: { partialSuccess: "report", rollback: "backup", log: true },
  settingsLayout: { mode: "sections", sections: [] },
  settings: [
    {
      id: "dwg_files",
      label: "DWG 파일",
      type: "repeatable-list",
      required: true,
      default: [],
      description: "",
      itemType: "file",
      valueKey: "file_path",
      showItemSummary: true,
      summaryCountKey: "title_block_count",
      summaryRangeKey: "number_range"
    },
    {
      id: "number_prefix",
      label: "접두어",
      type: "text",
      required: false,
      default: "A-",
      description: ""
    },
    {
      id: "start_number",
      label: "시작 번호",
      type: "number",
      required: true,
      default: 1,
      description: ""
    }
  ],
  actions: [
    {
      id: "preview",
      label: "분석 미리보기",
      runtimeAction: "preview",
      description: "",
      primary: true,
      requiresPreview: false,
      confirm: false
    }
  ],
  inputs: [],
  outputs: [],
  testCases: []
};

describe("tool execution model", () => {
  it("builds an AI/MCP request with resolved settings and title-block preview intent", () => {
    const request = buildToolExecutionRequest({
      toolName: "CAD 도면번호 일괄 순번 변경",
      menuName: "CAD",
      runtimeAction: "preview",
      schema: titleBlockSchema,
      values: {
        dwg_files: [
          { file_path: "C:/drawings/A-101.dwg" },
          { file_path: "C:/drawings/A-102.dwg" }
        ],
        number_prefix: "A-",
        start_number: 101
      }
    });

    expect(request.kind).toBe("ai-mcp-tool-execution");
    expect(request.requiredServers).toEqual(["cad"]);
    expect(request.commands[0]).toMatchObject({
      server: "cad",
      command: "cad.titleBlocks.previewRenumber",
      runtimeAction: "preview"
    });
    expect(JSON.stringify(request.commands[0].params.files)).toContain("A-101.dwg");
    expect(request.aiInstruction).toContain("도곽 후보");
    expect(request.aiInstruction).toContain("블록명");
  });

  it("extracts concrete title block candidates returned by CAD MCP", () => {
    const candidates = extractTitleBlockCandidates({
      titleBlockCandidates: [
        {
          id: "a1",
          blockName: "A1_TITLE",
          layoutName: "A-101",
          count: 12,
          sampleHandle: "4AF"
        },
        {
          name: "SHEET_FRAME",
          layout: "Model",
          occurrences: 2
        }
      ]
    });

    expect(candidates).toEqual([
      {
        id: "a1",
        label: "A1_TITLE",
        detail: "A-101 · 12개 · 핸들 4AF"
      },
      {
        id: "SHEET_FRAME",
        label: "SHEET_FRAME",
        detail: "Model · 2개"
      }
    ]);
  });

  it("does not invent title block candidates when CAD MCP returns none", () => {
    expect(extractTitleBlockCandidates({ ok: true })).toEqual([]);
  });
});
