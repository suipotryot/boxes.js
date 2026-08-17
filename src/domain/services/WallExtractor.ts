import type { ColorHeightRegistry } from '../models/ColorHeightRegistry';
import type { DividerGrid, LineNeighborRef } from '../models/Grid';
import type { Rect } from '../models/types';
import type { WallSegment } from '../models/WallSegment';
import { computeLineSegments, segmentWallId } from './GridDivider';

export interface WallExtractorInput {
  grid: DividerGrid;
  /** Inner cavity rect (inside the outer walls' inner face). */
  innerRect: Rect;
  outerThickness: number;
  innerThickness: number;
  outerColorId: string;
  colors: ColorHeightRegistry;
}

/**
 * Flattens the grid model into absolute WallSegments: the 4 outer walls
 * plus one WallSegment per PRESENT segment of every grid line. Wall ids are
 * deterministic (fixed 'outer-*' ids for the 4 sides, `segmentWallId(...)`
 * for dividers) rather than freshly random each call -- extract() reruns on
 * every project mutation via a Pinia getter, and anything holding onto a
 * wall id across renders (selection state, an open edit dialog) would
 * otherwise go stale the instant an unrelated part of the project changed.
 *
 * Every wall is represented by its *centerline* -- outer walls included,
 * inset outerThickness/2 in from the true outer envelope -- so that two
 * perpendicular walls always meet endpoint-to-endpoint at a shared point,
 * letting JunctionClassifier match junctions by exact point coincidence.
 *
 * A segment's `startMm`/`endMm` (from computeLineSegments) already land
 * exactly on the bordering line's own centerline when the boundary is
 * another line -- computeAxisBoundaries records that line's own positionMm
 * directly. Only a boundary against the box's own edge needs extending, by
 * outerThickness/2, since the inner rect's edge sits that much short of the
 * outer wall's centerline. This is simpler than the old tree-based
 * computeBoundarySides pass: a segment already carries the nature of both
 * its own boundaries via its start/end LineNeighborRef, no separate
 * side-annotation walk needed.
 */
export function extract(input: WallExtractorInput): WallSegment[] {
  const { grid, innerRect, outerThickness, innerThickness, outerColorId, colors } = input;

  const walls: WallSegment[] = [...buildOuterWalls(innerRect, outerThickness, outerColorId, colors)];

  for (const line of grid.lines) {
    for (const segment of computeLineSegments(line, grid.lines, innerRect)) {
      if (segment.removed) {
        continue; // an absent segment simply produces no wall -- that IS the gap.
      }
      const height = colors.getHeight(segment.colorId);
      // A 'line' boundary's offsetMm IS the bordering line's own centerline
      // already (computeAxisBoundaries records each crossing line's own
      // positionMm) -- no extension needed there. Only an 'edge' boundary
      // needs extending, since offsetMm there is the INNER rect's own edge,
      // outerThickness/2 short of the outer wall's centerline.
      const extend = (ref: LineNeighborRef): number => (ref.kind === 'edge' ? outerThickness / 2 : 0);
      const u0 = segment.startMm - extend(segment.start);
      const u1 = segment.endMm + extend(segment.end);
      const base: Omit<WallSegment, 'a' | 'b'> = {
        id: segmentWallId(line.id, segment.start, segment.end),
        height,
        thickness: innerThickness,
        isOuter: false,
        colorId: segment.colorId,
        notches: segment.notches,
      };
      walls.push(
        line.axis === 'x'
          ? { ...base, a: { x: innerRect.x + line.positionMm, y: innerRect.y + u0 }, b: { x: innerRect.x + line.positionMm, y: innerRect.y + u1 } }
          : { ...base, a: { x: innerRect.x + u0, y: innerRect.y + line.positionMm }, b: { x: innerRect.x + u1, y: innerRect.y + line.positionMm } },
      );
    }
  }

  return walls;
}

function buildOuterWalls(innerRect: Rect, outerThickness: number, outerColorId: string, colors: ColorHeightRegistry): WallSegment[] {
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
