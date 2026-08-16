import type { Axis, Rect } from '../models/types';
import type { ZoneNode } from '../models/Zone';

/**
 * Folds a ZoneNode tree into absolute rects, one per leaf zone id. At each
 * ZoneSplit, the first child takes `firstSize` from the split's origin edge;
 * the second child is offset by `firstSize + thickness`. Both children
 * inherit the parent's size on the other axis.
 */
export function computeZoneRects(root: ZoneNode, rootRect: Rect, thickness: number): Map<string, Rect> {
  const result = new Map<string, Rect>();

  const fold = (node: ZoneNode, rect: Rect): void => {
    // Recorded for every node, not just leaves: a split's own rect is the
    // combined span its two children occupy, needed to position the divider
    // wall it creates (see WallExtractor).
    result.set(node.id, rect);
    if (node.kind === 'leaf') {
      return;
    }
    const [firstRect, secondRect] = splitRect(rect, node.axis, node.firstSize, thickness);
    fold(node.first, firstRect);
    fold(node.second, secondRect);
  };

  fold(root, rootRect);
  return result;
}

function splitRect(rect: Rect, axis: Axis, firstSize: number, thickness: number): [Rect, Rect] {
  if (axis === 'x') {
    const secondX = rect.x + firstSize + thickness;
    return [
      { x: rect.x, y: rect.y, width: firstSize, height: rect.height },
      { x: secondX, y: rect.y, width: rect.x + rect.width - secondX, height: rect.height },
    ];
  }
  const secondY = rect.y + firstSize + thickness;
  return [
    { x: rect.x, y: rect.y, width: rect.width, height: firstSize },
    { x: rect.x, y: secondY, width: rect.width, height: rect.y + rect.height - secondY },
  ];
}
