import { describe, expect, it } from "vitest";
import {
  buildToolExecutionRequest,
  extractTitleBlockCandidates,
  toolExecutionFailureMessage,
  toolExecutionRecoveryMessage
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
  executionSteps: [],
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
      label: "미리보기",
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
    expect(request.aiInstruction).not.toMatch(/�|媛|紐|꾨|ㅽ/);
  });

  it("keeps only commands for the requested runtime action when commands are scoped", () => {
    const request = buildToolExecutionRequest({
      toolName: "CAD 도면번호 일괄 순번 변경",
      menuName: "CAD",
      runtimeAction: "preview",
      schema: {
        ...titleBlockSchema,
        mcpCommands: [
          {
            server: "cad",
            command: "cad.open_dwg",
            status: "planned",
            runtimeAction: "apply",
            params: {}
          },
          {
            server: "cad",
            command: "cad.detect_title_block_candidates",
            status: "available",
            runtimeAction: "preview",
            params: {}
          },
          {
            server: "cad",
            command: "cad.list_layers",
            status: "available",
            params: {}
          }
        ]
      },
      values: {}
    });

    expect(request.commands.map((command) => command.command)).toEqual([
      "cad.detect_title_block_candidates",
      "cad.list_layers"
    ]);
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

  it("detects explicit error and failed raw payloads before completing runtime steps", () => {
    expect(
      toolExecutionFailureMessage({
        status: "error",
        message: "CAD MCP 연결 실패"
      })
    ).toBe("CAD MCP 연결 실패");
    expect(
      toolExecutionFailureMessage({
        status: "preview",
        message: "",
        raw: { ok: false, error: "도곽 분석 실패" }
      })
    ).toBe("도곽 분석 실패");
    expect(
      toolExecutionFailureMessage({
        status: "completed",
        message: "",
        raw: { issues: [{ severity: "error", message: "원본 DWG를 찾을 수 없습니다." }] }
      })
    ).toBe("원본 DWG를 찾을 수 없습니다.");
    expect(
      toolExecutionFailureMessage({
        status: "preview",
        message: "",
        raw: { mcp: { ok: false, message: "도곽 후보를 찾지 못했습니다." } }
      })
    ).toBe("도곽 후보를 찾지 못했습니다.");
  });

  it("returns practical recovery messages for common MCP execution failures", () => {
    expect(
      toolExecutionRecoveryMessage({
        status: "error",
        message: "",
        raw: { code: "revitBusyOrBlocked", suggestion: "Press ESC in Revit" }
      })
    ).toContain("Revit에서 ESC");
    expect(
      toolExecutionRecoveryMessage({
        status: "error",
        message: "fetch failed ECONNREFUSED 127.0.0.1:5101"
      })
    ).toContain("MCP 서버에 연결하지 못했습니다");
    expect(
      toolExecutionRecoveryMessage({
        status: "error",
        message: "The operation has timed out."
      })
    ).toContain("응답 시간이 초과");
    expect(
      toolExecutionRecoveryMessage({
        status: "error",
        message: "",
        raw: { code: "emptySource", message: "Excel export has no rows to write." }
      })
    ).toContain("앞 노드 결과");
    expect(
      toolExecutionRecoveryMessage({
        status: "error",
        message: "",
        raw: { code: "selectionRequired", message: "Select AutoCAD TEXT or MTEXT objects first." }
      })
    ).toContain("AutoCAD에서 문자 객체를 먼저 선택");
    expect(
      toolExecutionRecoveryMessage({
        status: "error",
        message: "",
        raw: { code: "textSelectionRequired", message: "Selected objects do not include AutoCAD TEXT or MTEXT." }
      })
    ).toContain("TEXT/MTEXT");
    expect(
      toolExecutionRecoveryMessage({
        status: "error",
        message: "",
        raw: { code: "confirmApplyRequired", message: "Run again with confirmApply=true." }
      })
    ).toContain("적용 확인");
  });
});
