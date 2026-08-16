import type { AdvancedOptions, ProjectConfig } from '../models/Project';
import type { Notch } from '../models/Notch';
import type { Panel } from '../models/Panel';
import type { Point } from '../models/types';
import type { WallSegment } from '../models/WallSegment';
import { EPSILON, approxEqual, createId } from './GeometryUtils';
import { fingerEdgePath, fingerHoleRow } from './FingerJoint';
import { type JunctionInfo, isWallVertical, junctionDegreeForWall } from './JunctionClassifier';

/**
 * Builds a wall's finger-jointed outline and face holes. The panel is
 * produced in the wall's own *local* (u, v) frame -- u along its length
 * from `wall.a` (u=0) to `wall.b` (u=length), v up from the floor (v=0) to
 * the wall's own height (v=wall.height) -- not in absolute plan
 * coordinates. `placement3d` carries the info needed to place this flat,
 * unrolled shape back into the real 3D scene.
 *
 * Four edges:
 * - Bottom (v=0): finger comb into the base plate if `hasBottom`, else flush.
 * - Top (v=height): flush, except where an X-crossing carves a half-lap notch.
 * - Left/right ends (u=0 / u=length): a "compound edge" -- finger comb up to
 *   the height shared with whatever this wall butts against there, flush
 *   above that (only possible on the taller of the two walls).
 * - User grip notches (divider walls only) further carve into the top or
 *   bottom edge, centered on the wall's length.
 */
export function buildWallPanel(
  wall: WallSegment,
  allWalls: WallSegment[],
  junctions: Map<string, JunctionInfo>,
  config: ProjectConfig,
): Panel {
  const length = wallLength(wall);
  const fj = config.advanced.fingerJoint;
  const baseThickness = config.outerThickness;

  const xCrossingNotches = findXCrossingNotches(wall, length, allWalls, junctions, config.innerThickness);
  const bottomExtra = [
    ...xCrossingNotches.filter((n) => !n.fromTop),
    ...gripNotchRanges(wall.notches.filter((n) => n.edgeSide === 'bottom'), length),
  ];
  const topExtra = [
    ...xCrossingNotches.filter((n) => n.fromTop),
    ...gripNotchRanges(wall.notches.filter((n) => n.edgeSide === 'top'), length),
  ];

  const bottom = buildBottomEdge(length, config.hasBottom, baseThickness, fj, bottomExtra);
  const right = buildEndEdge(wall, wall.b, 'right', length, allWalls, junctions, fj);
  const top = buildTopEdge(length, wall.height, topExtra);
  const left = buildEndEdge(wall, wall.a, 'left', length, allWalls, junctions, fj);

  // `left`'s own points already run top-to-bottom (buildEndEdge reverses
  // them internally for side='left', see its own comment) -- that's
  // already the direction needed to continue the loop after `top`, so
  // reversing it *again* here would send it back to bottom-to-top. That
  // used to happen: it silently produced a valid-looking rectangle only
  // when both ends of this wall's comb reached exactly the same height
  // (the common outer-wall-meets-outer-wall case, where there's no extra
  // flush point past the comb to expose the mistake) -- but for any wall
  // whose comb stops short of its own full height (a divider or wall
  // meeting a shorter/taller neighbour), it spliced in a spurious straight
  // segment jumping from the top corner straight down to the bottom
  // corner, cutting right across the comb, and left the polygon
  // self-intersecting instead of closed.
  const outline = [...bottom, ...right, ...reversePath(top), ...left];

  const holes = buildFaceHoles(wall, allWalls, junctions, config);

  // The panel's own v=0 baseline is where it rests -- on the base plate's
  // *top* face (z = outerThickness) when there is one, not on the absolute
  // floor (z = 0, which is the base plate's *underside*). Without this
  // offset, v=0 lands at the same Z as the base plate's bottom, so the
  // finger tabs (which protrude further, to v = -baseThickness) end up
  // entirely below the base plate instead of passing through it.
  const originZ = config.hasBottom ? config.outerThickness : 0;

  return {
    id: createId('panel'),
    kind: wall.isOuter ? 'outerWall' : 'dividerWall',
    materialThickness: wall.thickness,
    outline,
    holes,
    placement3d: {
      origin: { x: wall.a.x, y: wall.a.y, z: originZ },
      rotationZ: Math.atan2(wall.b.y - wall.a.y, wall.b.x - wall.a.x),
    },
    sourceIds: [wall.id],
  };
}

export function wallLength(wall: WallSegment): number {
  return Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y);
}

function reversePath(points: Point[]): Point[] {
  return [...points].reverse();
}

// ---------------------------------------------------------------------------
// Bottom edge: finger comb into the base plate, or flush if there's no base.
// ---------------------------------------------------------------------------

function buildBottomEdge(
  length: number,
  hasBottom: boolean,
  baseThickness: number,
  fingerSettings: AdvancedOptions['fingerJoint'],
  extraNotches: NotchRange[],
): Point[] {
  const base: Point[] = hasBottom
    ? combToPoints(fingerEdgePath(length, fingerSettings, true), (kind) => (kind === 'finger' ? -baseThickness : 0))
    : [
        { x: 0, y: 0 },
        { x: length, y: 0 },
      ];
  return extraNotches.reduce((points, notch) => carveNotch(points, notch, 0), base);
}

// ---------------------------------------------------------------------------
// Top edge: flush, carved by X-crossing half-lap notches and grip notches.
// ---------------------------------------------------------------------------

function buildTopEdge(length: number, height: number, extraNotches: NotchRange[]): Point[] {
  const base: Point[] = [
    { x: 0, y: height },
    { x: length, y: height },
  ];
  return extraNotches.reduce((points, notch) => carveNotch(points, notch, height), base);
}

function combToPoints(segments: ReturnType<typeof fingerEdgePath>, offsetFor: (kind: string) => number): Point[] {
  const points: Point[] = [];
  for (const segment of segments) {
    const y = offsetFor(segment.kind);
    points.push({ x: segment.start, y });
    points.push({ x: segment.start + segment.length, y });
  }
  return points;
}

// ---------------------------------------------------------------------------
// End edges (compound edge): finger comb up to the shared height with
// whatever this wall butts against there, flush above that.
// ---------------------------------------------------------------------------

function buildEndEdge(
  wall: WallSegment,
  endPoint: Point,
  side: 'left' | 'right',
  length: number,
  allWalls: WallSegment[],
  junctions: Map<string, JunctionInfo>,
  fingerSettings: AdvancedOptions['fingerJoint'],
): Point[] {
  const mateHeight = findEndMateHeight(wall, endPoint, allWalls, junctions);
  // No mate found at all means nothing physically butts against this end
  // (only possible for a synthetic/standalone wall -- every wall produced
  // by WallExtractor always meets the outer wall or an ancestor divider):
  // flush the whole way rather than assuming a full comb.
  const combHeight = mateHeight === null ? 0 : Math.min(wall.height, mateHeight);
  const mateId = findEndMateId(wall, endPoint, allWalls, junctions);
  const startWithFinger = mateId === null ? true : wall.id < mateId;

  const points: Point[] = [];
  if (combHeight > 0) {
    const segments = fingerEdgePath(combHeight, fingerSettings, startWithFinger);
    for (const segment of segments) {
      const outward = segment.kind === 'finger' ? wall.thickness : 0;
      const u = side === 'right' ? length + outward : -outward;
      points.push({ x: u, y: segment.start });
      points.push({ x: u, y: segment.start + segment.length });
    }
  } else {
    points.push({ x: side === 'right' ? length : 0, y: 0 });
  }
  if (wall.height > combHeight) {
    points.push({ x: side === 'right' ? length : 0, y: wall.height });
  }

  // Left edge is traversed top-to-bottom in the outline; bottom edge starts
  // at u=0 -- so the left edge's own points must run height -> 0.
  return side === 'left' ? reversePath(points) : points;
}

function findEndMateHeight(
  wall: WallSegment,
  endPoint: Point,
  allWalls: WallSegment[],
  junctions: Map<string, JunctionInfo>,
): number | null {
  const mateId = findEndMateId(wall, endPoint, allWalls, junctions);
  if (mateId === null) {
    return null;
  }
  return allWalls.find((w) => w.id === mateId)?.height ?? null;
}

function findEndMateId(
  wall: WallSegment,
  endPoint: Point,
  allWalls: WallSegment[],
  junctions: Map<string, JunctionInfo>,
): string | null {
  const info = findJunctionAt(junctions, endPoint);
  if (!info) {
    return null;
  }
  const vertical = isWallVertical(wall);
  const ref = vertical ? (info.east ?? info.west) : (info.north ?? info.south);
  if (!ref || ref.segmentId === wall.id) {
    return null;
  }
  return allWalls.some((w) => w.id === ref.segmentId) ? ref.segmentId : null;
}

// ---------------------------------------------------------------------------
// X-crossing half-lap notches (§2.5 degree 2): the notch depth is
// min(heightA, heightB)/2. To interlock without collision, one of the two
// walls at a crossing is notched from its OWN top and the other from its
// OWN bottom (z=0) -- not both from the top -- so their solid halves don't
// overlap. Which one gets which is an arbitrary but deterministic tie-break
// on wall id, since physically either assignment is a valid interlock.
// ---------------------------------------------------------------------------

interface NotchRange {
  start: number;
  end: number;
  depth: number;
}

interface XCrossingNotch extends NotchRange {
  fromTop: boolean;
}

function findXCrossingNotches(
  wall: WallSegment,
  length: number,
  allWalls: WallSegment[],
  junctions: Map<string, JunctionInfo>,
  crossingWidth: number,
): XCrossingNotch[] {
  const notches: XCrossingNotch[] = [];
  for (const info of junctions.values()) {
    const u = projectOntoWall(wall, info.point);
    if (u === null || u <= EPSILON || u >= length - EPSILON) {
      continue; // not on this wall, or coincides with this wall's own endpoint
    }
    if (junctionDegreeForWall(info, wall) !== 2) {
      continue;
    }
    const vertical = isWallVertical(wall);
    const refs = vertical ? [info.east, info.west] : [info.north, info.south];
    const mateIds = [...new Set(refs.filter((r) => r !== null).map((r) => r!.segmentId))];
    const mateHeights = mateIds.map((id) => allWalls.find((w) => w.id === id)?.height ?? wall.height);
    const depth = Math.min(wall.height, ...mateHeights) / 2;
    const primaryMateId = mateIds[0] ?? wall.id;
    notches.push({
      start: u - crossingWidth / 2,
      end: u + crossingWidth / 2,
      depth,
      fromTop: wall.id < primaryMateId,
    });
  }
  return notches;
}

function projectOntoWall(wall: WallSegment, point: Point, epsilon: number = EPSILON): number | null {
  if (isWallVertical(wall)) {
    if (!approxEqual(wall.a.x, point.x, epsilon)) {
      return null;
    }
    return point.y - wall.a.y;
  }
  if (!approxEqual(wall.a.y, point.y, epsilon)) {
    return null;
  }
  return point.x - wall.a.x;
}

function findJunctionAt(junctions: Map<string, JunctionInfo>, point: Point): JunctionInfo | null {
  for (const info of junctions.values()) {
    if (approxEqual(info.point.x, point.x) && approxEqual(info.point.y, point.y)) {
      return info;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// User grip notches (divider walls only, per the plan): centered on the
// wall's length, rectangular or rounded, width and depth both adjustable.
// ---------------------------------------------------------------------------

function gripNotchRanges(notches: Notch[], length: number): NotchRange[] {
  return notches.map((notch) => {
    const center = length / 2;
    return { start: center - notch.width / 2, end: center + notch.width / 2, depth: notch.depth };
  });
}

/** Carves a rectangular dip into an edge's point list, replacing whatever was
 * there within [start, end] with a flat cut to `baseline -/+ depth`. */
function carveNotch(points: Point[], notch: NotchRange, baseline: number): Point[] {
  const notchV = baseline <= 0 ? baseline + notch.depth : baseline - notch.depth;
  const before = points.filter((p) => p.x <= notch.start + EPSILON);
  const after = points.filter((p) => p.x >= notch.end - EPSILON);
  return [
    ...before,
    { x: notch.start, y: baseline },
    { x: notch.start, y: notchV },
    { x: notch.end, y: notchV },
    { x: notch.end, y: baseline },
    ...after,
  ];
}

// ---------------------------------------------------------------------------
// Face holes: T-junction finger-hole rows (§2.5 degree 1), plus a second row
// for a fixed shelf attaching to this wall if it's an outer wall.
// ---------------------------------------------------------------------------

function buildFaceHoles(
  wall: WallSegment,
  allWalls: WallSegment[],
  junctions: Map<string, JunctionInfo>,
  config: ProjectConfig,
): Point[][] {
  const holes: Point[][] = [];
  const length = wallLength(wall);
  const fj = config.advanced.fingerJoint;

  for (const info of junctions.values()) {
    const u = projectOntoWall(wall, info.point);
    if (u === null || u <= EPSILON || u >= length - EPSILON) {
      continue;
    }
    if (junctionDegreeForWall(info, wall) !== 1) {
      continue;
    }
    const vertical = isWallVertical(wall);
    const ref = vertical ? (info.east ?? info.west) : (info.north ?? info.south);
    const entering = ref ? allWalls.find((w) => w.id === ref.segmentId) : undefined;
    if (!entering) {
      continue;
    }
    // fingerHoleRow tiles along its `length` axis; here that's the entering
    // wall's own HEIGHT (fingers run from the floor up), not the position
    // along this (carrying) wall's length -- so `rect.x`/`width` map to the
    // hole's v-range, while the crossing position `u` is a fixed, narrow
    // (entering wall's thickness) band on this wall's own u-axis.
    const rowHeight = Math.min(entering.height, wall.height);
    const rects = fingerHoleRow(0, rowHeight, fj, entering.thickness);
    for (const rect of rects) {
      const v0 = rect.x;
      const v1 = rect.x + rect.width;
      const u0 = u - rect.height / 2;
      const u1 = u + rect.height / 2;
      holes.push([
        { x: u0, y: v0 },
        { x: u1, y: v0 },
        { x: u1, y: v1 },
        { x: u0, y: v1 },
      ]);
    }
  }

  if (config.shelf?.mode === 'fixed' && wall.isOuter) {
    const rects = fingerHoleRow(0, length, fj, config.innerThickness);
    for (const rect of rects) {
      const y0 = config.shelf.heightMm - rect.height / 2;
      holes.push([
        { x: rect.x, y: y0 },
        { x: rect.x + rect.width, y: y0 },
        { x: rect.x + rect.width, y: y0 + rect.height },
        { x: rect.x, y: y0 + rect.height },
      ]);
    }
  }

  return holes;
}
