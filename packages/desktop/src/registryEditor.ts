import type { McpConnectionType, McpServerRecord, McpTarget, RegistryFile } from "@mcp-registry/shared";
import type { NewMcpServerInput } from "@mcp-registry/core";

export interface ServerDraft {
  name: string;
  target: McpTarget;
  connectionType: McpConnectionType;
  url: string;
  port: string;
  launchCommand: string;
  workingDirectory: string;
  notes: string;
}

export function createServerDraft(target: McpTarget): ServerDraft {
  return {
    name: "",
    target,
    connectionType: "http",
    url:
      target === "cad"
        ? "http://localhost:5100/mcp"
        : target === "revit"
          ? "http://localhost:5101/mcp"
          : target === "excel"
            ? "http://localhost:5200/mcp"
            : target === "tekla"
              ? "http://localhost:5300/mcp"
              : "http://localhost:3000/mcp",
    port:
      target === "cad"
        ? "5100"
        : target === "revit"
          ? "5101"
          : target === "excel"
            ? "5200"
            : target === "tekla"
              ? "5300"
              : "3000",
    launchCommand: "",
    workingDirectory: "",
    notes: ""
  };
}

export function serverDraftFromRecord(server: McpServerRecord): ServerDraft {
  return {
    name: server.name,
    target: server.target,
    connectionType: server.connectionType,
    url: server.url,
    port: server.port === null ? "" : String(server.port),
    launchCommand: server.launchCommand,
    workingDirectory: server.workingDirectory,
    notes: server.notes
  };
}

export function serverInputFromDraft(draft: ServerDraft): NewMcpServerInput {
  const trimmedPort = draft.port.trim();
  return {
    name: draft.name.trim(),
    target: draft.target,
    connectionType: draft.connectionType,
    url: draft.url.trim(),
    port: trimmedPort ? Number(trimmedPort) : null,
    launchCommand: draft.launchCommand.trim(),
    workingDirectory: draft.workingDirectory.trim(),
    environment: {},
    notes: draft.notes.trim()
  };
}

export function validateServerDraft(draft: ServerDraft): string[] {
  const errors: string[] = [];
  const input = serverInputFromDraft(draft);

  if (!input.name) {
    errors.push("서버 이름을 입력하세요.");
  }

  if (input.connectionType !== "stdio") {
    try {
      new URL(input.url);
    } catch {
      errors.push("URL 형식을 확인하세요.");
    }
  }

  if (
    input.port !== null &&
    (!Number.isInteger(input.port) || input.port < 1 || input.port > 65535)
  ) {
    errors.push("포트는 1-65535 사이여야 합니다.");
  }

  if (!input.launchCommand && (input.connectionType === "stdio" || errors.length > 0)) {
    errors.push("실행 명령을 입력하세요.");
  }

  return errors;
}

export function getSelectedServerId(registry: RegistryFile, preferredId: string): string {
  if (registry.servers.some((server) => server.id === preferredId)) {
    return preferredId;
  }

  return registry.servers[0]?.id ?? "";
}
