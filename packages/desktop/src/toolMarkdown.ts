export function parseToolMetadata(content: string) {
  if (!content.startsWith("---")) {
    return {};
  }

  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) {
    return {};
  }

  return Object.fromEntries(
    match[1]
      .split(/\r?\n/)
      .map((line) => line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/))
      .filter((item): item is RegExpMatchArray => Boolean(item))
      .map((item) => {
        const rawValue = item[2].trim();
        try {
          return [item[1], JSON.parse(rawValue)];
        } catch {
          return [item[1], rawValue.replace(/^["']|["']$/g, "")];
        }
      })
  );
}

export function stripToolMetadata(content: string) {
  return content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
}

function metadataBlock(content: string) {
  return content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)?.[1] ?? "";
}

function hasMetadataKey(content: string, key: string) {
  return new RegExp(`^${key}:`, "im").test(metadataBlock(content));
}

function metadataValue(content: string, key: string) {
  const match = metadataBlock(content).match(new RegExp(`^${key}:\\s*([^\\r\\n]+)`, "im"));
  return match?.[1]?.trim().replace(/^["']|["']$/g, "") ?? "";
}

export function normalizeToolContent(content: string) {
  return stripToolMetadata(content)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}_ -]/gu, "")
    .trim();
}

export function isToolMarkdown(content: string) {
  const metadata = parseToolMetadata(content) as Record<string, unknown>;
  const normalized = normalizeToolContent(content);
  const metadataSignals = [
    metadata.tool === true || metadata.tool === "true",
    metadata.toolName,
    metadata.name,
    metadata.version,
    metadata.author,
    metadata.sectionId,
    hasMetadataKey(content, "executionMode"),
    hasMetadataKey(content, "mcpCommands"),
    hasMetadataKey(content, "settings"),
    hasMetadataKey(content, "inputs"),
    hasMetadataKey(content, "outputs")
  ].filter(Boolean).length;
  const bodySignals = [
    /\btool\b/i,
    /\bcommand\b/i,
    /\bparameters?\b/i,
    /\binputs?\b/i,
    /\boutputs?\b/i,
    /\busage\b/i,
    /사용법|입력|출력|명령|실행|파라미터|도구|툴/
  ].filter((pattern) => pattern.test(normalized)).length;

  return metadataSignals >= 2 || bodySignals >= 2;
}

export function detectToolRiskWarnings(content: string) {
  const normalized = normalizeToolContent(content);
  const metadata = parseToolMetadata(content) as Record<string, unknown>;
  const riskValue = String(metadata.risk ?? metadataValue(content, "risk")).toLowerCase();
  const commandBlock = metadataBlock(content).toLowerCase();
  const destructiveActionPattern =
    /\b(delete|remove|erase|purge|destroy|wipe|clear|overwrite)\b|삭제|제거|지우|소거|정리|덮어쓰기/;
  const modifyActionPattern =
    /\b(update|modify|move|rename|set|write|change|batch)\b|수정|변경|이동|이름 변경|일괄|파라미터|쓰기/;
  const creationActionPattern =
    /\b(create|add|insert|generate|make|place|draw)\b|생성|추가|삽입|배치|작성|그리/;
  const modelObjectPattern =
    /\b(object|objects|element|elements|entity|entities|block|blocks|family|families|wall|walls|layer|layers|model|geometry)\b|객체|요소|블록|패밀리|벽|레이어|모델|형상|도면|부재/;
  const commandPattern =
    /\b(command|execute|run|operation|action|tool)\b|명령|실행|작업|동작|툴|도구/;
  const reasons: string[] = [];

  if (["delete", "destructive"].includes(riskValue)) {
    reasons.push("MD metadata에 삭제/덮어쓰기 위험도가 표시되어 있습니다.");
  } else if (["bulk-modify", "bulk_modify"].includes(riskValue)) {
    reasons.push("MD metadata에 대량 수정 위험도가 표시되어 있습니다.");
  } else if (["modify", "caution"].includes(riskValue)) {
    reasons.push("MD metadata에 원본 수정 또는 주의 필요 위험도가 표시되어 있습니다.");
  } else if (riskValue === "create") {
    reasons.push("MD metadata에 파일/객체 생성 동작이 표시되어 있습니다.");
  }

  if (
    destructiveActionPattern.test(normalized) ||
    (hasMetadataKey(content, "mcpCommands") && destructiveActionPattern.test(commandBlock))
  ) {
    if (modelObjectPattern.test(normalized) || modelObjectPattern.test(commandBlock)) {
      reasons.push("MD 내용에서 모델 객체나 요소를 삭제/제거할 수 있는 동작이 감지되었습니다.");
    }
  }

  if (
    modifyActionPattern.test(normalized) ||
    (hasMetadataKey(content, "mcpCommands") && modifyActionPattern.test(commandBlock))
  ) {
    if (modelObjectPattern.test(normalized) || modelObjectPattern.test(commandBlock)) {
      reasons.push("MD 내용에서 모델 객체나 요소를 수정/이동/일괄 변경할 수 있는 동작이 감지되었습니다.");
    }
  }

  if (
    creationActionPattern.test(normalized) &&
    modelObjectPattern.test(normalized) &&
    commandPattern.test(normalized)
  ) {
    reasons.push("MD 내용에서 모델 객체나 요소를 새로 생성/추가할 수 있는 동작이 감지되었습니다.");
  }

  return Array.from(new Set(reasons));
}
