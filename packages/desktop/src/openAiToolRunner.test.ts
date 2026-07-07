import { describe, expect, it } from "vitest";
import {
  buildOpenAiToolExecutionBody,
  extractOpenAiResponseText,
  openAiToolRunnerDefaultModel
} from "./openAiToolRunner";
import type { ToolExecutionRequest } from "./toolExecutionModel";

const request: ToolExecutionRequest = {
  kind: "ai-mcp-tool-execution",
  toolName: "CAD 도면번호 일괄 순번 변경",
  menuName: "CAD",
  runtimeAction: "preview",
  requiredServers: ["cad"],
  values: {
    dwg_files: [{ file_path: "C:/drawings/A-101.dwg" }],
    start_number: 101
  },
  commands: [
    {
      server: "cad",
      command: "cad.titleBlocks.previewRenumber",
      status: "planned",
      runtimeAction: "preview",
      params: {
        files: [{ file_path: "C:/drawings/A-101.dwg" }],
        start: 101
      }
    }
  ],
  aiInstruction: "도곽 후보를 실제 CAD MCP 결과 기준으로 판단합니다.",
  createdAt: "2026-07-08T00:00:00.000Z"
};

describe("openAiToolRunner", () => {
  it("builds a Responses API body with the tool request and execution rules", () => {
    const body = buildOpenAiToolExecutionBody(request, "test-model");

    expect(body.model).toBe("test-model");
    expect(body.input).toContain("AI Program");
    expect(body.input).toContain("CAD 도면번호 일괄 순번 변경");
    expect(body.input).toContain("cad.titleBlocks.previewRenumber");
    expect(body.input).toContain("C:/drawings/A-101.dwg");
    expect(body.input).toContain("실제 CAD/Revit/Excel 조작은 로컬 MCP 서버가 수행합니다");
  });

  it("uses the current direct API default model when none is configured", () => {
    expect(openAiToolRunnerDefaultModel).toBe("gpt-5.5");
  });

  it("extracts output text from common Responses API shapes", () => {
    expect(
      extractOpenAiResponseText({
        output_text: "direct text"
      })
    ).toBe("direct text");

    expect(
      extractOpenAiResponseText({
        output: [
          {
            type: "message",
            content: [{ type: "output_text", text: "nested text" }]
          }
        ]
      })
    ).toBe("nested text");
  });
});
