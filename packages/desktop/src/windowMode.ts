export interface WindowModeSize {
  width: number;
  height: number;
}

export function getWindowModeSize(isCompact: boolean): WindowModeSize {
  return isCompact ? { width: 560, height: 780 } : { width: 1440, height: 900 };
}
