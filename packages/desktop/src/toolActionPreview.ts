import type { ToolRuntimeSchema, ToolSettingValue } from "./toolSettingsSchema";

export interface ToolPreviewSummaryRow {
  id: string;
  fileName: string;
  countLabel: string;
  rangeLabel: string;
  status: "ready" | "missing-input";
}

function textValue(value: ToolSettingValue | undefined, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function numberValue(value: ToolSettingValue | undefined, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function basename(path: string) {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path;
}

function formatNumber(value: number, digitCount: number) {
  return String(value).padStart(Math.max(1, digitCount), "0");
}

export function buildToolPreviewSummary(
  schema: ToolRuntimeSchema,
  values?: Record<string, ToolSettingValue>
): ToolPreviewSummaryRow[] {
  const fileListField = schema.settings.find(
    (field) => field.type === "repeatable-list" && field.itemType === "file" && field.showItemSummary
  );
  if (!fileListField || !values) {
    return [];
  }

  const rawRows = values[fileListField.id];
  const rows = Array.isArray(rawRows)
    ? rawRows.filter((item): item is Record<string, string | number | boolean> =>
        Boolean(item) && typeof item === "object" && !Array.isArray(item)
      )
    : [];

  const valueKey = fileListField.valueKey ?? "file_path";
  const countKey = fileListField.summaryCountKey ?? "count";
  const rangeKey = fileListField.summaryRangeKey ?? "range";
  const prefix = textValue(values.number_prefix, "");
  const startNumber = numberValue(values.start_number, 1);
  const digitCount = numberValue(values.digit_count, 1);
  let nextNumber = startNumber;

  return rows.map((row, index) => {
    const rawPath = String(row[valueKey] ?? row.file_path ?? row.path ?? "");
    const titleBlockCount = Math.max(1, numberValue(row[countKey] as ToolSettingValue, 1));
    const first = nextNumber;
    const last = nextNumber + titleBlockCount - 1;
    nextNumber = last + 1;
    const generatedRange = `${prefix}${formatNumber(first, digitCount)}~${prefix}${formatNumber(last, digitCount)}`;

    return {
      id: `${rawPath || "file"}-${index}`,
      fileName: rawPath ? basename(rawPath) : `파일 ${index + 1}`,
      countLabel: row[countKey] ? `도곽 ${titleBlockCount}개` : "도곽 1개",
      rangeLabel: String(row[rangeKey] || generatedRange),
      status: rawPath ? "ready" : "missing-input"
    };
  });
}
