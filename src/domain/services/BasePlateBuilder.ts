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

  const outline = basePlateOutline(outerRect, outerThickness, walls, fingerSettings);
  // Only divider walls' finger holes stay as closed interior holes -- a
  // divider sits away from the plate's boundary, so its finger positions
  // are genuinely enclosed. Outer walls' finger positions are carved into
  // the outline itself, see basePlateOutline's docstring for why.
  const holes = walls.filter((w) => !w.isOuter).flatMap((wall) => bottomFingerHoles(wall, fingerSettings));

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

/**
 * The base plate's outer perimeter: an n x n square relieved out of each
 * corner (so the outer walls' own corner finger joints have somewhere to
 * seat), and each of the 4 straight runs between corners carved with the
 * matching outer wall's own finger comb.
 *
 * An outer wall's finger tabs land *at* the plate's true edge -- its
 * centerline sits exactly halfway through the edge margin, at half its own
 * thickness in from the true outer boundary -- so unlike a divider's
 * finger holes (always interior, see `bottomFingerHoles`), these must be
 * open notches cut into the outline itself rather than separate closed
 * holes. Burn correction treats every subpath independently: a closed hole
 * that merely *touches* the outline along one side (rather than being
 * part of it) drifts apart from that edge once corrected -- the outline
 * pushes outward, the hole shrinks inward -- leaving a thin sliver of
 * uncut material where an open tooth was meant to be (holes rendering as
 * "almost at the edge" instead of true teeth).
 */
function basePlateOutline(
  rect: Rect,
  notchSize: number,
  walls: WallSegment[],
  fingerSettings: AdvancedOptions['fingerJoint'],
): Point[] {
  const { x, y, width, height } = rect;
  const n = Math.min(notchSize, width / 2, height / 2);
  const center = { x: x + width / 2, y: y + height / 2 };
  const wallById = (id: string): WallSegment | undefined => walls.find((w) => w.id === id);

  const northRun = edgeRun({ x: x + n, y }, { x: x + width - n, y }, wallById('outer-north'), center, fingerSettings);
  const eastRun = edgeRun(
    { x: x + width, y: y + n },
    { x: x + width, y: y + height - n },
    wallById('outer-east'),
    center,
    fingerSettings,
  );
  const southRun = edgeRun(
    { x: x + width - n, y: y + height },
    { x: x + n, y: y + height },
    wallById('outer-south'),
    center,
    fingerSettings,
  );
  const westRun = edgeRun({ x, y: y + height - n }, { x, y: y + n }, wallById('outer-west'), center, fingerSettings);

  // Traverse CCW from bottom-left; each run's own start/end points are
  // already supplied explicitly around it, so only its interior (notch)
  // points get spliced in.
  return [
    { x, y: y + n },
    { x: x + n, y: y + n },
    { x: x + n, y },
    ...northRun.slice(1, -1),
    { x: x + width - n, y },
    { x: x + width - n, y: y + n },
    { x: x + width, y: y + n },
    ...eastRun.slice(1, -1),
    { x: x + width, y: y + height - n },
    { x: x + width - n, y: y + height - n },
    { x: x + width - n, y: y + height },
    ...southRun.slice(1, -1),
    { x: x + n, y: y + height },
    { x: x + n, y: y + height - n },
    { x, y: y + height - n },
    ...westRun.slice(1, -1),
  ];
}

function edgeRun(
  runStart: Point,
  runEnd: Point,
  wall: WallSegment | undefined,
  rectCenter: Point,
  fingerSettings: AdvancedOptions['fingerJoint'],
): Point[] {
  if (!wall) {
    return [runStart, runEnd];
  }
  const length = wallLength(wall);
  const dx = (wall.b.x - wall.a.x) / length;
  const dy = (wall.b.y - wall.a.y) / length;
  const runLength = Math.hypot(runEnd.x - runStart.x, runEnd.y - runStart.y);
  const runDx = runLength > 0 ? (runEnd.x - runStart.x) / runLength : dx;
  const runDy = runLength > 0 ? (runEnd.y - runStart.y) / runLength : dy;
  // The run (corner to corner along the plate outline) and the wall's own
  // u-axis (from wall.a to wall.b) can point in opposite directions --
  // walk the finger segments in whichever order keeps them monotonic
  // along the run.
  const aligned = dx * runDx + dy * runDy > 0;
  const inward = inwardNormal(dx, dy, wall, rectCenter);
  const depth = wall.thickness;

  let segments = fingerEdgePath(length, fingerSettings, true).filter((s) => s.kind === 'finger');
  if (!aligned) {
    segments = [...segments].reverse();
  }

  const points: Point[] = [runStart];
  for (const seg of segments) {
    const uNear = aligned ? seg.start : seg.start + seg.length;
    const uFar = aligned ? seg.start + seg.length : seg.start;
    const edgeNear: Point = { x: wall.a.x + dx * uNear, y: wall.a.y + dy * uNear };
    const edgeFar: Point = { x: wall.a.x + dx * uFar, y: wall.a.y + dy * uFar };
    points.push(
      edgeNear,
      { x: edgeNear.x + inward.x * depth, y: edgeNear.y + inward.y * depth },
      { x: edgeFar.x + inward.x * depth, y: edgeFar.y + inward.y * depth },
      edgeFar,
    );
  }
  points.push(runEnd);
  return points;
}

function inwardNormal(dx: number, dy: number, wall: WallSegment, rectCenter: Point): Point {
  const perpendicular = { x: -dy, y: dx };
  const mid = { x: (wall.a.x + wall.b.x) / 2, y: (wall.a.y + wall.b.y) / 2 };
  const towardCenter = { x: rectCenter.x - mid.x, y: rectCenter.y - mid.y };
  const dot = perpendicular.x * towardCenter.x + perpendicular.y * towardCenter.y;
  return dot >= 0 ? perpendicular : { x: -perpendicular.x, y: -perpendicular.y };
}
