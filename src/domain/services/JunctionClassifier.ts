import type { Point } from '../models/types';
import type { WallSegment } from '../models/WallSegment';
import { EPSILON, approxEqual, pointKey, pointsEqual } from './GeometryUtils';

export interface JunctionRef {
  segmentId: string;
}

export interface JunctionInfo {
  point: Point;
  north: JunctionRef | null;
  south: JunctionRef | null;
  east: JunctionRef | null;
  west: JunctionRef | null;
}

/**
 * Generalizes boxes.py's grid-index degree counting to continuous
 * coordinates: instead of counting how many grid cells touch a corner, it
 * counts how many wall segments coincide with a point (within epsilon).
 *
 * For every candidate point (every wall endpoint, deduplicated), and every
 * wall: if the wall is collinear with the point and the point falls
 * *strictly inside* the wall's span, the wall passes through it (both sides
 * along the wall's own axis are occupied). If the point instead coincides
 * with one of the wall's own endpoints, the wall only extends away from the
 * point on one side.
 */
export function classifyJunctions(walls: WallSegment[], epsilon: number = EPSILON): Map<string, JunctionInfo> {
  const points = collectCandidatePoints(walls, epsilon);
  const junctions = new Map<string, JunctionInfo>();

  for (const point of points) {
    const info: JunctionInfo = { point, north: null, south: null, east: null, west: null };
    for (const wall of walls) {
      applyWallContribution(info, wall, epsilon);
    }
    junctions.set(pointKey(point), info);
  }

  return junctions;
}

/**
 * Degree = number of non-null sides on the axis perpendicular to `wall`.
 * 0 = plain edge, 1 = T-junction (finger-joint holes), 2 = X-crossing
 * (half-lap notch on both walls).
 */
export function junctionDegreeForWall(info: JunctionInfo, wall: WallSegment): 0 | 1 | 2 {
  const sides = isVertical(wall) ? [info.east, info.west] : [info.north, info.south];
  return sides.filter((side) => side !== null).length as 0 | 1 | 2;
}

function collectCandidatePoints(walls: WallSegment[], epsilon: number): Point[] {
  const points: Point[] = [];
  const addUnique = (p: Point): void => {
    if (!points.some((existing) => pointsEqual(existing, p, epsilon))) {
      points.push(p);
    }
  };
  for (const wall of walls) {
    addUnique(wall.a);
    addUnique(wall.b);
  }
  return points;
}

function isVertical(wall: WallSegment): boolean {
  return approxEqual(wall.a.x, wall.b.x);
}

function applyWallContribution(info: JunctionInfo, wall: WallSegment, epsilon: number): void {
  const ref: JunctionRef = { segmentId: wall.id };
  const p = info.point;

  if (isVertical(wall)) {
    if (!approxEqual(wall.a.x, p.x, epsilon)) {
      return;
    }
    const loY = Math.min(wall.a.y, wall.b.y);
    const hiY = Math.max(wall.a.y, wall.b.y);
    if (p.y > loY + epsilon && p.y < hiY - epsilon) {
      info.north = ref;
      info.south = ref;
    } else if (approxEqual(p.y, loY, epsilon)) {
      info.south = ref; // wall's north endpoint -> body extends south from P
    } else if (approxEqual(p.y, hiY, epsilon)) {
      info.north = ref; // wall's south endpoint -> body extends north from P
    }
    return;
  }

  // Horizontal wall.
  if (!approxEqual(wall.a.y, p.y, epsilon)) {
    return;
  }
  const loX = Math.min(wall.a.x, wall.b.x);
  const hiX = Math.max(wall.a.x, wall.b.x);
  if (p.x > loX + epsilon && p.x < hiX - epsilon) {
    info.east = ref;
    info.west = ref;
  } else if (approxEqual(p.x, loX, epsilon)) {
    info.east = ref; // wall's west endpoint -> body extends east from P
  } else if (approxEqual(p.x, hiX, epsilon)) {
    info.west = ref; // wall's east endpoint -> body extends west from P
  }
}
