export interface KeyboardShortcutLike {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
}

export type CustomFlowShortcutMode = "home" | "editor";

export function isSaveShortcut(event: KeyboardShortcutLike) {
  return (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s";
}

export function canSaveCustomFlowFromShortcut(
  event: KeyboardShortcutLike & { workflowMode: CustomFlowShortcutMode }
) {
  return event.workflowMode === "editor" && isSaveShortcut(event);
}

export function canAutoPersistCustomFlowGraph(workflowMode: CustomFlowShortcutMode) {
  return workflowMode === "editor";
}
