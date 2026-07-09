import { basename } from "node:path";
import type { FlowActiveFileSelection } from "./customFlowModel";
import type { McpServerRecord } from "@mcp-registry/shared";

type ActiveFileProgram = FlowActiveFileSelection["program"];

export function activeFileProgramForTarget(target: McpServerRecord["target"]) {
  if (target === "cad") {
    return "cad" as const;
  }
  if (target === "revit") {
    return "revit" as const;
  }
  if (target === "excel") {
    return "excel" as const;
  }
  return null;
}

export function activeFileProbeUrls(serverUrl: string) {
  const normalizedUrl = serverUrl.trim();
  if (!normalizedUrl) {
    return [];
  }

  try {
    const url = new URL(normalizedUrl);
    const endpointPath = url.pathname.replace(/\/+$/, "");
    const basePath = endpointPath.endsWith("/mcp")
      ? endpointPath.slice(0, -"/mcp".length) || "/"
      : endpointPath || "/";
    const baseUrl = new URL(url.toString());
    baseUrl.pathname = basePath;
    baseUrl.search = "";
    baseUrl.hash = "";

    const roots = [
      baseUrl.toString().replace(/\/+$/, ""),
      normalizedUrl.replace(/\/+$/, "")
    ];
    const suffixes = ["active-file", "active_file", "current-file", "current_file", "status"];

    return Array.from(
      new Set(
        roots.flatMap((root) => suffixes.map((suffix) => `${root}/${suffix}`))
      )
    );
  } catch {
    return [];
  }
}

export function extractDetectedActiveFiles(
  payload: unknown,
  program: ActiveFileProgram,
  sourceId: string
): FlowActiveFileSelection[] {
  const candidates = activeFileCandidates(payload);

  return candidates
    .map((candidate, index) => normalizeActiveFileCandidate(candidate, program, sourceId, index))
    .filter((item): item is FlowActiveFileSelection => Boolean(item));
}

function activeFileCandidates(payload: unknown): unknown[] {
  if (!payload || typeof payload !== "object") {
    return typeof payload === "string" ? [payload] : [];
  }

  const record = payload as Record<string, unknown>;
  const directCandidates = [
    record.activeFile,
    record.active_file,
    record.currentFile,
    record.current_file,
    record.file,
    record.document,
    record.workbook
  ].filter(Boolean);
  const arrayCandidates = [
    record.activeFiles,
    record.active_files,
    record.files,
    record.documents,
    record.openFiles,
    record.open_files
  ].flatMap((value) => (Array.isArray(value) ? value : []));

  return [...directCandidates, ...arrayCandidates];
}

function normalizeActiveFileCandidate(
  candidate: unknown,
  program: ActiveFileProgram,
  sourceId: string,
  index: number
): FlowActiveFileSelection | null {
  if (typeof candidate === "string") {
    const label = fileLabelFromPath(candidate);
    return {
      id: index === 0 ? `active-${program}` : `active-${program}-${sourceId}-${index}`,
      label,
      program,
      path: candidate
    };
  }

  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  const record = candidate as Record<string, unknown>;
  const rawPath = firstString(
    record.path,
    record.fullName,
    record.fullPath,
    record.full_path,
    record.filePath,
    record.file_path,
    record.name,
    record.fileName,
    record.file_name,
    record.title
  );
  if (!rawPath) {
    return null;
  }

  const label =
    firstString(record.name, record.fileName, record.file_name, record.title) ??
    fileLabelFromPath(rawPath);

  return {
    id: index === 0 ? `active-${program}` : `active-${program}-${sourceId}-${index}`,
    label,
    program,
    path: rawPath
  };
}

function firstString(...values: unknown[]) {
  return values.find((value): value is string => typeof value === "string" && value.trim().length > 0);
}

function fileLabelFromPath(path: string) {
  const normalizedPath = path.replace(/\\/g, "/");
  return basename(normalizedPath) || path;
}
