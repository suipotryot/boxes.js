// Builds one wall segment's flat-pattern outline: a local (u,v) rectangle
// where u runs along the wall's length and v runs up its height, with the
// four edges combed to interlock with whatever they meet.
//
// Central convention (write once, reference everywhere — this exact
// omission is what causes half-thickness/overshoot bugs): a wall's tab
// protrudes past its own centerline by *the mate's* thickness / 2, never
// its own thickness. See matingProtrusion() below; every edge builder in
// this file goes through it instead of re-deriving a protrusion depth.
import { fingerEdgePath } from './FingerJoint.js';
import { simplifyPolygon } from './Point.js';
import { resolveThickness, resolveHeight, perpendicularMatesAtPoint } from '../model/GridQuery.js';

export function matingProtrusion(mateThicknessMm) {
  return mateThicknessMm / 2;
}

function maxThickness(mates, project) {
  return mates.length ? Math.max(...mates.map((m) => resolveThickness(m, project))) : 0;
}

// One end edge (u=0 or u=length), combed along v (height). `atRight`
// selects which end; `reverse` flips point order so the caller can compose
// a non-self-intersecting outline (the left end must run top->bottom while
// every other edge runs the other way — getting this backwards is exactly
// the double-reversal bug that produced self-intersecting outlines before).
function endEdgePoints({ length: L, height: H, mateHalfThickness, fj, startWithFinger, atRight, reverse }) {
  const baseU = atRight ? L : 0;
  const dir = atRight ? 1 : -1;
  let pts;
  if (mateHalfThickness <= 0) {
    pts = [{ x: baseU, y: 0 }, { x: baseU, y: H }];
  } else {
    const segs = fingerEdgePath(H, fj, startWithFinger);
    pts = [];
    for (const seg of segs) {
      const u = seg.kind === 'finger' ? baseU + dir * mateHalfThickness : baseU;
      pts.push({ x: u, y: seg.start });
      pts.push({ x: u, y: seg.start + seg.length });
    }
  }
  return reverse ? pts.slice().reverse() : pts;
}

// Bottom edge (v=0), combed along u (length), protruding down into the
// base plate's thickness at 'finger' positions.
function bottomEdgePoints({ length: L, mateHalfThickness, fj, startWithFinger }) {
  if (mateHalfThickness <= 0) return [{ x: 0, y: 0 }, { x: L, y: 0 }];
  const segs = fingerEdgePath(L, fj, startWithFinger);
  const pts = [];
  for (const seg of segs) {
    const v = seg.kind === 'finger' ? -mateHalfThickness : 0;
    pts.push({ x: seg.start, y: v });
    pts.push({ x: seg.start + seg.length, y: v });
  }
  return pts;
}

/**
 * @param {object} wallSeg one entry from GridQuery.enumerateWallSegments()
 * @param {object} grid
 * @param {object} project
 * @param {boolean} hasBasePlate whether this wall's bottom combs into a floor
 */
export function buildWallPanel(wallSeg, grid, project, hasBasePlate) {
  const { kind, c, r, seg, aPoint, bPoint } = wallSeg;
  const length = kind === 'v' ? grid.sy[r] : grid.sx[c];
  const height = resolveHeight(seg, project);
  const fj = project.fingerJoint;

  const matesA = perpendicularMatesAtPoint(grid, kind, aPoint[0], aPoint[1]);
  const matesB = perpendicularMatesAtPoint(grid, kind, bPoint[0], bPoint[1]);
  const halfA = matingProtrusion(maxThickness(matesA, project));
  const halfB = matingProtrusion(maxThickness(matesB, project));

  // Axis-based convention guarantees complementary alternation between any
  // two mates without needing a per-pair tie-break: a 'v' wall's ends and
  // its bottom edge always lead with a finger; the 'h'/base-plate mates it
  // interlocks with always lead with a space, by construction of this rule
  // applying uniformly to every segment.
  const startWithFinger = kind === 'v';
  const baseHalf = hasBasePlate ? matingProtrusion(project.outerThicknessMm) : 0;

  const bottom = bottomEdgePoints({ length, mateHalfThickness: baseHalf, fj, startWithFinger });
  const right = endEdgePoints({ length, height, mateHalfThickness: halfB, fj, startWithFinger, atRight: true, reverse: false });
  const top = [{ x: length, y: height }, { x: 0, y: height }];
  const left = endEdgePoints({ length, height, mateHalfThickness: halfA, fj, startWithFinger, atRight: false, reverse: true });

  const outline = simplifyPolygon([...bottom, ...right, ...top, ...left]);

  return {
    id: `wall-${kind}-${c}-${r}`,
    kind: 'wall',
    thicknessGroup: seg.thicknessGroup,
    thicknessMm: resolveThickness(seg, project),
    outline,
    holes: [],
  };
}
