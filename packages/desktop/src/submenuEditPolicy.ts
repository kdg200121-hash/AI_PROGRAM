export interface SubmenuHeaderIdentity {
  sectionId: string;
  submenuId: string;
}

export function canEditSubmenuHeader({ sectionId, submenuId }: SubmenuHeaderIdentity) {
  return sectionId === "workflow" && !submenuId.startsWith("custom-tool-");
}
