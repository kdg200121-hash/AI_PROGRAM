import { describe, expect, it } from "vitest";
import { buildToolPreviewSummary } from "./toolActionPreview";
import type { ToolRuntimeSchema } from "./toolSettingsSchema";

const schema: ToolRuntimeSchema = {
  risk: "bulk-modify",
  executionMode: "mcp",
  requiredServers: ["cad"],
  mcpCommands: [],
  preflightChecks: [],
  resultSchema: { type: "table", fields: [] },
  failurePolicy: { partialSuccess: "report", rollback: "none", log: true },
  settingsLayout: { mode: "sections", sections: [] },
  inputs: [],
  outputs: [],
  testCases: [],
  actions: [],
  settings: [
    {
      id: "dwg_files",
      label: "DWG 파일 목록",
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
      required: true,
      default: "P-",
      description: ""
    },
    {
      id: "start_number",
      label: "시작번호",
      type: "number",
      required: true,
      default: 101,
      description: ""
    },
    {
      id: "digit_count",
      label: "자리수",
      type: "number",
      required: true,
      default: 3,
      description: ""
    }
  ]
};

describe("buildToolPreviewSummary", () => {
  it("builds file row summaries from repeatable DWG settings", () => {
    const rows = buildToolPreviewSummary(schema, {
      dwg_files: [
        { file_path: "C:/drawings/A.dwg", title_block_count: 2 },
        { file_path: "C:/drawings/B.dwg", title_block_count: 1 }
      ],
      number_prefix: "P-",
      start_number: 101,
      digit_count: 3
    });

    expect(rows).toEqual([
      {
        id: "C:/drawings/A.dwg-0",
        fileName: "A.dwg",
        countLabel: "도곽 2개",
        rangeLabel: "P-101~P-102",
        status: "ready"
      },
      {
        id: "C:/drawings/B.dwg-1",
        fileName: "B.dwg",
        countLabel: "도곽 1개",
        rangeLabel: "P-103~P-103",
        status: "ready"
      }
    ]);
  });
});
