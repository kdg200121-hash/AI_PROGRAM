export interface MeasuredTab {
  id: string;
  width: number;
}

export function getHiddenTabIds(tabs: MeasuredTab[], availableWidth: number) {
  const hiddenIds: string[] = [];
  let usedWidth = 0;

  tabs.forEach((tab) => {
    usedWidth += tab.width;
    if (usedWidth > availableWidth) {
      hiddenIds.push(tab.id);
    }
  });

  return hiddenIds;
}
