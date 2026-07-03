import type { NewMcpServerInput } from "./registryStore";

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export function validateServerInput(input: NewMcpServerInput): ValidationResult {
  const errors: string[] = [];

  if (!input.name.trim()) {
    errors.push("서버 이름을 입력해야 합니다.");
  }

  if (input.connectionType !== "stdio") {
    try {
      new URL(input.url);
    } catch {
      errors.push("URL 형식이 올바르지 않습니다.");
    }
  }

  if (
    input.port !== null &&
    (!Number.isInteger(input.port) || input.port < 1 || input.port > 65535)
  ) {
    errors.push("포트는 1부터 65535 사이여야 합니다.");
  }

  if (!input.launchCommand.trim()) {
    errors.push("실행 명령을 입력해야 합니다.");
  }

  return { ok: errors.length === 0, errors };
}
