export interface WindowModeSize {
  width: number;
  height: number;
}

export function getWindowModeSize(isCompact: boolean): WindowModeSize {
  return isCompact ? { width: 420, height: 760 } : { width: 1200, height: 760 };
}
