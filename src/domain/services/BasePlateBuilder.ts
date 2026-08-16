import type { AdvancedOptions } from '../models/Project';
import type { Panel } from '../models/Panel';
import type { Point, Rect } from '../models/types';
import type { WallSegment } from '../models/WallSegment';
import { createId } from './GeometryUtils';
import { fingerEdgePath } from './FingerJoint';
import { wallLength } from './PanelBuilder';

/**
 * The base plate: a single piece covering the whole outer footprint (no
 * per-zone splitting, per the plan's simplification), with a finger hole
 * for every 'finger' segment of every wall's bottom edge (outer walls and
 * dividers alike -- reusing the exact same fingerEdgePath call PanelBuilder
 * uses for each wall's own bottom edge keeps the two panels in sync by
 * construction), and a small L-shaped relief notch cut into each of the 4
 * outer corners so the outer walls' own corner finger joints have somewhere
 * to seat without interference.
 */
export function buildBasePlate(
  walls: WallSegment[],
  innerRect: Rect,
  outerThickness: number,
  fingerSettings: AdvancedOptions['fingerJoint'],
  hasBottom: boolean,
): Panel | null {
  if (!hasBottom) {
    return null;
  }

  const outerRect: Rect = {
    x: innerRect.x - outerThickness,
    y: innerRect.y - outerThickness,
    width: innerRect.width + 2 * outerThickness,
    height: innerRect.height + 2 * outerThickness,
  };

  const outline = rectangleWithCornerNotches(outerRect, outerThickness);
  const holes = walls.flatMap((wall) => bottomFingerHoles(wall, fingerSettings));

  return {
    id: createId('panel'),
    kind: 'basePlate',
    materialThickness: outerThickness,
    outline,
    holes,
    placement3d: { origin: { x: 0, y: 0, z: 0 }, rotationZ: 0 },
    sourceIds: walls.map((w) => w.id),
  };
}

function bottomFingerHoles(wall: WallSegment, fingerSettings: AdvancedOptions['fingerJoint']): Point[][] {
  const length = wallLength(wall);
  const dx = (wall.b.x - wall.a.x) / length;
  const dy = (wall.b.y - wall.a.y) / length;
  const halfThickness = wall.thickness / 2;
  // Perpendicular to the wall's direction, for the hole's narrow dimension.
  const px = -dy * halfThickness;
  const py = dx * halfThickness;

  return fingerEdgePath(length, fingerSettings, true)
    .filter((segment) => segment.kind === 'finger')
    .map((segment) => {
      const p0: Point = { x: wall.a.x + dx * segment.start, y: wall.a.y + dy * segment.start };
      const p1: Point = { x: wall.a.x + dx * (segment.start + segment.length), y: wall.a.y + dy * (segment.start + segment.length) };
      return [
        { x: p0.x - px, y: p0.y - py },
        { x: p1.x - px, y: p1.y - py },
        { x: p1.x + px, y: p1.y + py },
        { x: p0.x + px, y: p0.y + py },
      ];
    });
}

function rectangleWithCornerNotches(rect: Rect, notchSize: number): Point[] {
  const { x, y, width, height } = rect;
  const n = Math.min(notchSize, width / 2, height / 2);
  // Traverse CCW from bottom-left, cutting an n x n square out of each
  // corner instead of passing through it directly.
  return [
    { x: x, y: y + n },
    { x: x + n, y: y + n },
    { x: x + n, y: y },
    { x: x + width - n, y: y },
    { x: x + width - n, y: y + n },
    { x: x + width, y: y + n },
    { x: x + width, y: y + height - n },
    { x: x + width - n, y: y + height - n },
    { x: x + width - n, y: y + height },
    { x: x + n, y: y + height },
    { x: x + n, y: y + height - n },
    { x: x, y: y + height - n },
  ];
}
