import type { ColorHeightRegistry } from '../models/ColorHeightRegistry';
import type { Rect } from '../models/types';
import type { ZoneNode, ZoneSplit } from '../models/Zone';
import type { WallSegment } from '../models/WallSegment';
import { computeZoneRects } from './ZoneTree';
import { createId } from './GeometryUtils';

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
 * plus one divider wall per ZoneSplit. Every wall is represented by its
 * *centerline* -- outer walls included, inset outerThickness/2 in from the
 * true outer envelope -- so that two perpendicular walls always meet
 * endpoint-to-endpoint at a shared point, letting outer-wall corners reuse
 * the same compound-edge corner-joint handling as divider wall ends.
 */
export function extract(input: WallExtractorInput): WallSegment[] {
  const { zoneTree, innerRect, outerThickness, innerThickness, outerColorId, colors } = input;

  const walls: WallSegment[] = [...buildOuterWalls(innerRect, outerThickness, outerColorId, colors)];

  const zoneRects = computeZoneRects(zoneTree, innerRect, innerThickness);
  for (const split of collectSplits(zoneTree)) {
    const rect = zoneRects.get(split.id);
    if (!rect) {
      throw new Error(`Missing computed rect for split ${split.id}`);
    }
    walls.push(buildDividerWall(split, rect, innerThickness, colors));
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

  const make = (a: { x: number; y: number }, b: { x: number; y: number }): WallSegment => ({
    id: createId('wall-outer'),
    a,
    b,
    height,
    thickness: outerThickness,
    isOuter: true,
    colorId: outerColorId,
    notches: [],
  });

  return [
    make({ x: cx, y: cy }, { x: cx, y: cy + ch }), // west
    make({ x: cx + cw, y: cy }, { x: cx + cw, y: cy + ch }), // east
    make({ x: cx, y: cy }, { x: cx + cw, y: cy }), // north
    make({ x: cx, y: cy + ch }, { x: cx + cw, y: cy + ch }), // south
  ];
}

function buildDividerWall(
  split: ZoneSplit,
  rect: Rect,
  innerThickness: number,
  colors: ColorHeightRegistry,
): WallSegment {
  const height = colors.getHeight(split.dividerColorId);
  const base: Omit<WallSegment, 'a' | 'b'> = {
    id: createId('wall-divider'),
    height,
    thickness: innerThickness,
    isOuter: false,
    colorId: split.dividerColorId,
    notches: split.notches,
  };

  if (split.axis === 'x') {
    const centerX = rect.x + split.firstSize + innerThickness / 2;
    return { ...base, a: { x: centerX, y: rect.y }, b: { x: centerX, y: rect.y + rect.height } };
  }
  const centerY = rect.y + split.firstSize + innerThickness / 2;
  return { ...base, a: { x: rect.x, y: centerY }, b: { x: rect.x + rect.width, y: centerY } };
}

function collectSplits(node: ZoneNode): ZoneSplit[] {
  if (node.kind === 'leaf') {
    return [];
  }
  return [node, ...collectSplits(node.first), ...collectSplits(node.second)];
}
