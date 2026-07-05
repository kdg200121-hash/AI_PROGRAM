export type ToolStatusTone = "blue" | "green" | "red" | "amber";

export interface ToolStatusItem {
  label: string;
  tone: ToolStatusTone;
}

export function ToolStatusRow({ items }: { items: ToolStatusItem[] }) {
  return (
    <div className="toolStatusRow">
      {items.map((item) => (
        <span className={`toolStatusPill ${item.tone}`} key={`${item.tone}-${item.label}`}>
          {item.label}
        </span>
      ))}
    </div>
  );
}
