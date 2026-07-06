export interface SmartGuideRect {
  id: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface SmartGuideLine {
  axis: "x" | "y";
  type: "align" | "spacing";
  position: number;
  start: number;
  end: number;
  label?: string;
  labelX?: number;
  labelY?: number;
}

export interface SmartGuideSnapInput {
  moving: SmartGuideRect;
  stationary: SmartGuideRect[];
  threshold?: number;
}

export interface SmartGuideSnapResult {
  deltaX: number;
  deltaY: number;
  guides: SmartGuideLine[];
}

const defaultSnapThreshold = 8;

function centerX(rect: SmartGuideRect) {
  return (rect.left + rect.right) / 2;
}

function centerY(rect: SmartGuideRect) {
  return (rect.top + rect.bottom) / 2;
}

function width(rect: SmartGuideRect) {
  return rect.right - rect.left;
}

function height(rect: SmartGuideRect) {
  return rect.bottom - rect.top;
}

function chooseCloser(
  current: { delta: number; distance: number; guides: SmartGuideLine[] } | null,
  next: { delta: number; distance: number; guides: SmartGuideLine[] }
) {
  if (!current || next.distance < current.distance) {
    return next;
  }
  return current;
}

function alignmentSnapX(moving: SmartGuideRect, stationary: SmartGuideRect[], threshold: number) {
  let best: { delta: number; distance: number; guides: SmartGuideLine[] } | null = null;
  const movingPoints = [moving.left, centerX(moving), moving.right];

  stationary.forEach((target) => {
    const targetPoints = [target.left, centerX(target), target.right];
    movingPoints.forEach((movingPoint) => {
      targetPoints.forEach((targetPoint) => {
        const delta = targetPoint - movingPoint;
        const distance = Math.abs(delta);
        if (distance > threshold) {
          return;
        }

        best = chooseCloser(best, {
          delta,
          distance,
          guides: [{
            axis: "x",
            type: "align",
            position: targetPoint,
            start: Math.min(moving.top, target.top),
            end: Math.max(moving.bottom, target.bottom)
          }]
        });
      });
    });
  });

  return best;
}

function alignmentSnapY(moving: SmartGuideRect, stationary: SmartGuideRect[], threshold: number) {
  let best: { delta: number; distance: number; guides: SmartGuideLine[] } | null = null;
  const movingPoints = [moving.top, centerY(moving), moving.bottom];

  stationary.forEach((target) => {
    const targetPoints = [target.top, centerY(target), target.bottom];
    movingPoints.forEach((movingPoint) => {
      targetPoints.forEach((targetPoint) => {
        const delta = targetPoint - movingPoint;
        const distance = Math.abs(delta);
        if (distance > threshold) {
          return;
        }

        best = chooseCloser(best, {
          delta,
          distance,
          guides: [{
            axis: "y",
            type: "align",
            position: targetPoint,
            start: Math.min(moving.left, target.left),
            end: Math.max(moving.right, target.right)
          }]
        });
      });
    });
  });

  return best;
}

function spacingSnapX(moving: SmartGuideRect, stationary: SmartGuideRect[], threshold: number) {
  let best: { delta: number; distance: number; guides: SmartGuideLine[] } | null = null;

  for (let firstIndex = 0; firstIndex < stationary.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < stationary.length; secondIndex += 1) {
      const left = stationary[firstIndex].left <= stationary[secondIndex].left
        ? stationary[firstIndex]
        : stationary[secondIndex];
      const right = left === stationary[firstIndex] ? stationary[secondIndex] : stationary[firstIndex];
      const available = right.left - left.right;
      if (available < width(moving)) {
        continue;
      }

      const targetLeft = left.right + (available - width(moving)) / 2;
      const gap = (available - width(moving)) / 2;
      const delta = targetLeft - moving.left;
      const distance = Math.abs(delta);
      if (distance > threshold) {
        continue;
      }

      best = chooseCloser(best, {
        delta,
        distance,
        guides: [{
          axis: "x",
          type: "spacing",
          position: targetLeft,
          start: Math.min(left.top, moving.top, right.top),
          end: Math.max(left.bottom, moving.bottom, right.bottom),
          label: `${Math.round(gap)}px`,
          labelX: left.right + gap / 2,
          labelY: (Math.min(left.top, moving.top, right.top) + Math.max(left.bottom, moving.bottom, right.bottom)) / 2
        }]
      });
    }
  }

  return best;
}

function spacingSnapY(moving: SmartGuideRect, stationary: SmartGuideRect[], threshold: number) {
  let best: { delta: number; distance: number; guides: SmartGuideLine[] } | null = null;

  for (let firstIndex = 0; firstIndex < stationary.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < stationary.length; secondIndex += 1) {
      const top = stationary[firstIndex].top <= stationary[secondIndex].top
        ? stationary[firstIndex]
        : stationary[secondIndex];
      const bottom = top === stationary[firstIndex] ? stationary[secondIndex] : stationary[firstIndex];
      const available = bottom.top - top.bottom;
      if (available < height(moving)) {
        continue;
      }

      const targetTop = top.bottom + (available - height(moving)) / 2;
      const gap = (available - height(moving)) / 2;
      const delta = targetTop - moving.top;
      const distance = Math.abs(delta);
      if (distance > threshold) {
        continue;
      }

      best = chooseCloser(best, {
        delta,
        distance,
        guides: [{
          axis: "y",
          type: "spacing",
          position: targetTop,
          start: Math.min(top.left, moving.left, bottom.left),
          end: Math.max(top.right, moving.right, bottom.right),
          label: `${Math.round(gap)}px`,
          labelX: (Math.min(top.left, moving.left, bottom.left) + Math.max(top.right, moving.right, bottom.right)) / 2,
          labelY: top.bottom + gap / 2
        }]
      });
    }
  }

  return best;
}

export function calculateSmartGuideSnap(input: SmartGuideSnapInput): SmartGuideSnapResult {
  const threshold = input.threshold ?? defaultSnapThreshold;
  const alignX = alignmentSnapX(input.moving, input.stationary, threshold);
  const alignY = alignmentSnapY(input.moving, input.stationary, threshold);
  const spacingX = spacingSnapX(input.moving, input.stationary, threshold);
  const spacingY = spacingSnapY(input.moving, input.stationary, threshold);
  const bestX = chooseCloser(alignX, spacingX ?? alignX ?? { delta: 0, distance: Infinity, guides: [] });
  const bestY = chooseCloser(alignY, spacingY ?? alignY ?? { delta: 0, distance: Infinity, guides: [] });

  return {
    deltaX: bestX?.distance === Infinity ? 0 : bestX?.delta ?? 0,
    deltaY: bestY?.distance === Infinity ? 0 : bestY?.delta ?? 0,
    guides: [
      ...(bestX?.distance === Infinity ? [] : bestX?.guides ?? []),
      ...(bestY?.distance === Infinity ? [] : bestY?.guides ?? [])
    ]
  };
}
