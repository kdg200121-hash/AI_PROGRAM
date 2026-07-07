import type { ToolExecutionRequest } from "./toolExecutionModel";

export const openAiToolRunnerDefaultModel = "gpt-5.5";

export interface OpenAiResponsesBody {
  model: string;
  input: string;
}

function compactJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export function buildOpenAiToolExecutionPrompt(request: ToolExecutionRequest) {
  return [
    "AI Program 툴 실행 요청입니다.",
    "",
    "역할:",
    "- 사용자가 입력한 설정값과 MD 툴의 실행 계획을 검토합니다.",
    "- 필요한 MCP 명령 순서와 파라미터를 점검합니다.",
    "- 실제 CAD/Revit/Excel 조작은 로컬 MCP 서버가 수행합니다.",
    "- 도면, 모델, 엑셀 파일의 실제 객체/요소/셀 값은 임의로 만들지 않습니다.",
    "- 로컬 MCP 응답이 필요한 정보는 반드시 MCP 실행 결과가 필요하다고 표시합니다.",
    "",
    "응답 형식:",
    "- 한국어로 간결하게 답합니다.",
    "- 실행 요약, 필요한 MCP, 주의사항, 다음 단계가 있으면 포함합니다.",
    "- JSON만 강제하지 않아도 되지만, 가능한 경우 commands 배열을 함께 설명합니다.",
    "",
    "툴 실행 요청:",
    compactJson({
      toolName: request.toolName,
      menuName: request.menuName,
      runtimeAction: request.runtimeAction,
      requiredServers: request.requiredServers,
      values: request.values,
      commands: request.commands,
      aiInstruction: request.aiInstruction,
      createdAt: request.createdAt
    })
  ].join("\n");
}

export function buildOpenAiToolExecutionBody(
  request: ToolExecutionRequest,
  model = openAiToolRunnerDefaultModel
): OpenAiResponsesBody {
  return {
    model,
    input: buildOpenAiToolExecutionPrompt(request)
  };
}

function contentText(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }
  if (!value || typeof value !== "object") {
    return [];
  }
  const record = value as Record<string, unknown>;
  const text = record.text;
  if (typeof text === "string") {
    return [text];
  }
  return [];
}

export function extractOpenAiResponseText(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return "";
  }
  const record = payload as Record<string, unknown>;
  if (typeof record.output_text === "string") {
    return record.output_text;
  }
  if (!Array.isArray(record.output)) {
    return "";
  }
  return record.output
    .flatMap((item) => {
      if (!item || typeof item !== "object") {
        return [];
      }
      const content = (item as Record<string, unknown>).content;
      return Array.isArray(content) ? content.flatMap(contentText) : [];
    })
    .join("\n")
    .trim();
}
