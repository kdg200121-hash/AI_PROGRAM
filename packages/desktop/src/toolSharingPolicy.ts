export type ToolRegistrationMode = "open" | "approval";

function parseVersion(value: string) {
  return value
    .replace(/^v/i, "")
    .split(".")
    .map((part) => Number.parseInt(part, 10) || 0);
}

export function isNewerVersion(candidate: string, current: string) {
  const left = parseVersion(candidate);
  const right = parseVersion(current);
  const length = Math.max(left.length, right.length);

  for (let index = 0; index < length; index += 1) {
    const leftPart = left[index] ?? 0;
    const rightPart = right[index] ?? 0;
    if (leftPart > rightPart) {
      return true;
    }
    if (leftPart < rightPart) {
      return false;
    }
  }

  return false;
}

export function shouldRequireSharedToolReview(input: {
  mode: ToolRegistrationMode;
  riskWarnings: string[];
}) {
  return input.mode === "approval" || input.riskWarnings.length > 0;
}
