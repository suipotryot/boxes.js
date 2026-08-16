import type { Axis, Rect } from '../models/types';
import type { ZoneNode } from '../models/Zone';
import { createId } from './GeometryUtils';

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

export type BoundaryKind = 'outer' | 'inner';

export interface BoundarySides {
  north: BoundaryKind;
  south: BoundaryKind;
  east: BoundaryKind;
  west: BoundaryKind;
}

const ALL_OUTER: BoundarySides = { north: 'outer', south: 'outer', east: 'outer', west: 'outer' };

/**
 * For every node, records which of its 4 sides border the box's outer wall
 * ('outer', true only at the root) versus a divider created by an ancestor
 * split ('inner'). Used by WallExtractor to know, per side, whether a
 * divider's span should reach the outer wall's centerline or an ancestor
 * divider's centerline -- see the fix note in WallExtractor.ts.
 */
export function computeBoundarySides(root: ZoneNode): Map<string, BoundarySides> {
  const result = new Map<string, BoundarySides>();

  const fold = (node: ZoneNode, sides: BoundarySides): void => {
    result.set(node.id, sides);
    if (node.kind === 'leaf') {
      return;
    }
    if (node.axis === 'x') {
      fold(node.first, { ...sides, east: 'inner' });
      fold(node.second, { ...sides, west: 'inner' });
    } else {
      fold(node.first, { ...sides, south: 'inner' });
      fold(node.second, { ...sides, north: 'inner' });
    }
  };

  fold(root, ALL_OUTER);
  return result;
}

const MIN_ZONE_SIZE_MM = 1;

/**
 * A split is only valid if both the divider's own thickness and a sliver of
 * usable space (>= MIN_ZONE_SIZE_MM) remain for *both* children -- a split
 * that consumes the whole zone in thickness+firstSize would produce a
 * degenerate (zero or negative size) second zone.
 */
export function canSplitZone(zoneRect: Rect, axis: Axis, firstSize: number, thickness: number): boolean {
  const zoneSize = axis === 'x' ? zoneRect.width : zoneRect.height;
  const secondSize = zoneSize - firstSize - thickness;
  return firstSize >= MIN_ZONE_SIZE_MM && secondSize >= MIN_ZONE_SIZE_MM;
}

/**
 * Replaces the leaf `targetLeafId` with a new split, creating two fresh
 * leaf children. Per the plan, a divider is fixed at creation in V1 -- there
 * is no move/resize, only split and merge. Returns a new tree (the input is
 * never mutated), matching the snapshot-based undo/redo model.
 */
export function splitZone(tree: ZoneNode, targetLeafId: string, axis: Axis, firstSize: number, dividerColorId: string): ZoneNode {
  if (tree.kind === 'leaf') {
    if (tree.id !== targetLeafId) {
      return tree;
    }
    return {
      kind: 'split',
      id: createId('split'),
      axis,
      firstSize,
      dividerColorId,
      notches: [],
      first: { kind: 'leaf', id: createId('zone') },
      second: { kind: 'leaf', id: createId('zone') },
    };
  }
  return { ...tree, first: splitZone(tree.first, targetLeafId, axis, firstSize, dividerColorId), second: splitZone(tree.second, targetLeafId, axis, firstSize, dividerColorId) };
}

/**
 * Collapses the split `targetSplitId` (and everything under it) back into a
 * single fresh leaf -- "delete the divider" per the plan's V1 model: to
 * reposition one, merge it away and re-split rather than dragging it.
 */
export function mergeZone(tree: ZoneNode, targetSplitId: string): ZoneNode {
  if (tree.kind === 'leaf') {
    return tree;
  }
  if (tree.id === targetSplitId) {
    return { kind: 'leaf', id: createId('zone') };
  }
  return { ...tree, first: mergeZone(tree.first, targetSplitId), second: mergeZone(tree.second, targetSplitId) };
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
