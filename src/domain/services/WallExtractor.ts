import type { ColorHeightRegistry } from '../models/ColorHeightRegistry';
import type { Rect } from '../models/types';
import type { ZoneNode, ZoneSplit } from '../models/Zone';
import type { WallSegment } from '../models/WallSegment';
import { type BoundaryKind, type BoundarySides, computeBoundarySides, computeZoneRects } from './ZoneTree';

export interface WallExtractorInput {
  zoneTree: ZoneNode;
  /** Inner cavity rect (inside the outer walls' inner face). */
  innerRect: Rect;
  outerThickness: number;
  innerThickness: number;
  outerColorId: string;
  colors: ColorHeightRegistry;
}

/**
 * Flattens the ZoneNode tree into absolute WallSegments: the 4 outer walls
 * plus one divider wall per ZoneSplit. Wall ids are deterministic (fixed
 * 'outer-*' ids for the 4 sides, `divider-${split.id}` for dividers) rather
 * than freshly random each call -- extract() reruns on every project
 * mutation via a Pinia getter, and anything holding onto a wall id across
 * renders (selection state, an open edit dialog) would otherwise go stale
 * the instant an unrelated part of the project changed.
 *
 * Every wall is represented by its
 * *centerline* -- outer walls included, inset outerThickness/2 in from the
 * true outer envelope -- so that two perpendicular walls always meet
 * endpoint-to-endpoint at a shared point, letting outer-wall corners reuse
 * the same compound-edge corner-joint handling as divider wall ends.
 *
 * A divider's own leaf/split rect only extends to the *edge* of the gap
 * it borders (see ZoneTree.computeZoneRects), not to the centerline of
 * whatever occupies that gap -- so each divider span is grown by half the
 * bordering thickness on every side, using computeBoundarySides to know
 * whether that side borders the outer wall (outerThickness/2) or an
 * ancestor's divider (innerThickness/2). Without this, a divider's endpoint
 * would sit half a thickness short of the wall it butts against, and
 * JunctionClassifier's exact-point matching would silently miss the joint.
 */
export function extract(input: WallExtractorInput): WallSegment[] {
  const { zoneTree, innerRect, outerThickness, innerThickness, outerColorId, colors } = input;

  const walls: WallSegment[] = [...buildOuterWalls(innerRect, outerThickness, outerColorId, colors)];

  const zoneRects = computeZoneRects(zoneTree, innerRect, innerThickness);
  const boundarySides = computeBoundarySides(zoneTree);
  for (const split of collectSplits(zoneTree)) {
    const rect = zoneRects.get(split.id);
    const sides = boundarySides.get(split.id);
    if (!rect || !sides) {
      throw new Error(`Missing computed rect/boundary for split ${split.id}`);
    }
    walls.push(buildDividerWall(split, rect, sides, outerThickness, innerThickness, colors));
  }

  return walls;
}

function buildOuterWalls(
  innerRect: Rect,
  outerThickness: number,
  outerColorId: string,
  colors: ColorHeightRegistry,
): WallSegment[] {
  const half = outerThickness / 2;
  const cx = innerRect.x - half;
  const cy = innerRect.y - half;
  const cw = innerRect.width + outerThickness;
  const ch = innerRect.height + outerThickness;
  const height = colors.getHeight(outerColorId);

  const make = (id: string, a: { x: number; y: number }, b: { x: number; y: number }): WallSegment => ({
    id,
    a,
    b,
    height,
    thickness: outerThickness,
    isOuter: true,
    colorId: outerColorId,
    notches: [],
  });

  return [
    make('outer-west', { x: cx, y: cy }, { x: cx, y: cy + ch }),
    make('outer-east', { x: cx + cw, y: cy }, { x: cx + cw, y: cy + ch }),
    make('outer-north', { x: cx, y: cy }, { x: cx + cw, y: cy }),
    make('outer-south', { x: cx, y: cy + ch }, { x: cx + cw, y: cy + ch }),
  ];
}

function buildDividerWall(
  split: ZoneSplit,
  rect: Rect,
  sides: BoundarySides,
  outerThickness: number,
  innerThickness: number,
  colors: ColorHeightRegistry,
): WallSegment {
  const height = colors.getHeight(split.dividerColorId);
  const base: Omit<WallSegment, 'a' | 'b'> = {
    id: `divider-${split.id}`,
    height,
    thickness: innerThickness,
    isOuter: false,
    colorId: split.dividerColorId,
    notches: split.notches,
  };
  const extent = (side: BoundaryKind): number => (side === 'outer' ? outerThickness / 2 : innerThickness / 2);

  if (split.axis === 'x') {
    const centerX = rect.x + split.firstSize + innerThickness / 2;
    const y0 = rect.y - extent(sides.north);
    const y1 = rect.y + rect.height + extent(sides.south);
    return { ...base, a: { x: centerX, y: y0 }, b: { x: centerX, y: y1 } };
  }
  const centerY = rect.y + split.firstSize + innerThickness / 2;
  const x0 = rect.x - extent(sides.west);
  const x1 = rect.x + rect.width + extent(sides.east);
  return { ...base, a: { x: x0, y: centerY }, b: { x: x1, y: centerY } };
}

function collectSplits(node: ZoneNode): ZoneSplit[] {
  if (node.kind === 'leaf') {
    return [];
  }
  return [node, ...collectSplits(node.first), ...collectSplits(node.second)];
}
