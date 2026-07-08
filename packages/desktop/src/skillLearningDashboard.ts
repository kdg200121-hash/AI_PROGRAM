export type SkillLearningStatus = "pending" | "applied";

export interface ToolLearningLogEntry {
  id: string;
  toolName: string;
  version: string;
  author: string;
  sourcePath: string;
  title: string;
  summary: string;
  recommendation: string;
  status: SkillLearningStatus;
}

export interface ToolLearningSource {
  id: string;
  name: string;
  version: string;
  author: string;
  path?: string;
  sourcePath?: string;
  learningLog?: unknown;
  toolSchema?: unknown;
}

function rawLearningLog(source: ToolLearningSource) {
  const schema =
    source.toolSchema && typeof source.toolSchema === "object"
      ? (source.toolSchema as { learningLog?: unknown })
      : null;
  return source.learningLog ?? schema?.learningLog;
}

function textValue(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function entryField(entry: Record<string, unknown>, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = textValue(entry[key]);
    if (value) {
      return value;
    }
  }
  return fallback;
}

export function collectToolLearningEntries(
  tools: ToolLearningSource[],
  appliedEntryIds: string[] = []
): ToolLearningLogEntry[] {
  const appliedIds = new Set(appliedEntryIds);

  return tools.flatMap((tool) => {
    const raw = rawLearningLog(tool);
    const entries = Array.isArray(raw) ? raw : raw ? [raw] : [];

    return entries.map((entry, index) => {
      const objectEntry =
        entry && typeof entry === "object" ? (entry as Record<string, unknown>) : null;
      const summary = objectEntry
        ? entryField(objectEntry, ["summary", "message", "note", "context"], "검토할 학습 메모입니다.")
        : String(entry);
      const id = objectEntry
        ? entryField(objectEntry, ["id"], `${tool.id}:learning:${index}`)
        : `${tool.id}:learning:${index}`;

      return {
        id,
        toolName: tool.name,
        version: tool.version,
        author: tool.author,
        sourcePath: tool.sourcePath ?? tool.path ?? "",
        title: objectEntry
          ? entryField(objectEntry, ["title", "topic", "issue"], "스킬 보완 항목")
          : "스킬 보완 항목",
        summary,
        recommendation: objectEntry
          ? entryField(objectEntry, ["recommendation", "action", "nextStep"], "")
          : "",
        status: appliedIds.has(id) ? "applied" : "pending"
      } satisfies ToolLearningLogEntry;
    });
  });
}

export function buildSkillUpdateDraft(entries: ToolLearningLogEntry[]) {
  const pendingEntries = entries.filter((entry) => entry.status === "pending");
  if (pendingEntries.length === 0) {
    return "미반영된 스킬 보완 데이터가 없습니다.";
  }

  return [
    "# 스킬 업데이트 초안",
    "",
    "아래 항목은 자동으로 스킬 파일을 덮어쓰지 않고, 검토 후 반영할 패치 초안입니다.",
    "",
    ...pendingEntries.flatMap((entry, index) => [
      `## ${index + 1}. ${entry.title}`,
      `- 툴: ${entry.toolName} v${entry.version}`,
      `- 제작자: ${entry.author}`,
      entry.sourcePath ? `- 출처: ${entry.sourcePath}` : "- 출처: 없음",
      `- 관찰 내용: ${entry.summary}`,
      entry.recommendation ? `- 제안 반영: ${entry.recommendation}` : "- 제안 반영: 검토 후 작성",
      ""
    ])
  ].join("\n");
}
