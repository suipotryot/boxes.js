// The base plate's outline is the box's outer footprint, with open notches
// carved directly into its boundary wherever an outer wall's bottom comb
// has a 'finger' — never as separate hole polygons that merely touch the
// boundary. Two independently-offset subpaths (outline vs. a "touching"
// hole) can drift apart under burn correction and leave an uncut sliver;
// carving the notch into the outline itself makes that impossible.
//
// The outer perimeter is always exactly one run per side (see
// GridQuery.enumerateWallRuns), so each side's notches come from a single
// PanelBuilder.bottomCombSegments() call spanning the whole side — the
// exact same segmentation the now-single-piece outer wall panel's own
// bottom edge uses, so a base-plate notch can never drift out of sync
// with the wall tab it receives.
import { simplifyPolygon } from './Point.js';
import { matingProtrusion, bottomCombSegments } from './PanelBuilder.js';
import { resolveThickness, enumerateWallRuns } from '../model/GridQuery.js';
import { xAt, yAt, isOuterSegment } from '../model/Grid.js';

// Finger holes for interior dividers. Unlike the outer notches above,
// these never touch the plate's boundary, so — unlike the "touching hole"
// bug class that motivated carving outer notches into the outline itself —
// each can safely be an independent closed hole; burn correction offsets
// it inward on its own without any risk of drifting off an edge it never
// touches. Same bottomCombSegments() call (and hence the same
// fingerEdgePath) as the divider's own bottom edge in PanelBuilder — so a
// hole can never drift out of sync with the tabs it's meant to receive,
// and correctly has *no* hole wherever an X crossing has notched that
// divider's own bottom edge away (nothing there to comb). Hole width is
// the *run's own* resolved thickness (mixed thickness groups included,
// since resolveThickness already respects a segment's individually-set
// thicknessGroup) — this is a physical footprint, not a mating
// protrusion, so it's never mate.thickness/2.
//
// Winding matters here: BurnCorrection reuses the exact same
// outward-normal formula for holes as for outlines, just with the offset
// distance negated, so each hole's point order must make that formula's
// normal point away from its own interior, or burn correction *grows* it
// instead of shrinking it. Verified empirically per loop below (not just
// derived by symmetry) — swapping which axis is the "thickness" one
// between the v and h cases is a reflection, which flips which point
// order is correct, so the v-loop and h-loop orders below are
// deliberately *not* the same shape with x/y swapped. A regression test
// asserts a burn-corrected hole is smaller than nominal, not larger.
function dividerFingerHoles(innerRuns, grid, project) {
  const holes = [];
  for (const run of innerRuns) {
    const half = resolveThickness(run.seg, project) / 2;
    const segs = bottomCombSegments(run, grid, project);
    if (run.kind === 'v') {
      const x = xAt(grid, run.c);
      const y0 = yAt(grid, run.rStart);
      for (const s of segs) {
        if (s.kind !== 'finger') continue;
        holes.push([
          { x: x - half, y: y0 + s.start },
          { x: x + half, y: y0 + s.start },
          { x: x + half, y: y0 + s.start + s.length },
          { x: x - half, y: y0 + s.start + s.length },
        ]);
      }
    } else {
      const y = yAt(grid, run.r);
      const x0 = xAt(grid, run.cStart);
      for (const s of segs) {
        if (s.kind !== 'finger') continue;
        holes.push([
          { x: x0 + s.start, y: y - half },
          { x: x0 + s.start + s.length, y: y - half },
          { x: x0 + s.start + s.length, y: y + half },
          { x: x0 + s.start, y: y + half },
        ]);
      }
    }
  }
  return holes;
}

function edgeNotchPoints(run, grid, project, axisPoint, inward, reverse) {
  if (!run) return [];
  const half = matingProtrusion(project.outerThicknessMm);
  const pts = [];
  for (const s of bottomCombSegments(run, grid, project)) {
    const depth = s.kind === 'finger' ? half : 0;
    const p0 = axisPoint(s.start);
    const p1 = axisPoint(s.start + s.length);
    pts.push({ x: p0.x + inward.x * depth, y: p0.y + inward.y * depth });
    pts.push({ x: p1.x + inward.x * depth, y: p1.y + inward.y * depth });
  }
  return reverse ? pts.slice().reverse() : pts;
}

/** The box's W×D outer-perimeter outline, edge-jointed against the 4 outer
 *  wall runs — shared by the base plate and the flush-fitting fixed lid,
 *  since both are geometrically the exact same "flat sheet mating against
 *  every outer wall" shape (the base plate at the bottom, the lid at the
 *  top when it sits flush with the perimeter height); only the Z position
 *  differs, which this app's flat 2D pieces don't encode. `protrude:
 *  true` flips the notches outward into tabs instead — used by the fixed
 *  lid's RECESSED case (see LidBuilder), where the lid's tabs poke out to
 *  meet holes cut mid-height into the walls rather than the walls poking
 *  into notches cut into the lid's own edge. Exported for LidBuilder. */
export function buildOuterEdgeOutline(grid, project, { protrude = false } = {}) {
  const cols = grid.sx.length;
  const rows = grid.sy.length;
  const W = grid.sx.reduce((a, b) => a + b, 0);
  const D = grid.sy.reduce((a, b) => a + b, 0);

  const runs = enumerateWallRuns(grid);
  const outerRuns = runs.filter((run) => isOuterSegment(grid, run.kind, run.aPoint[0], run.aPoint[1]));
  const topRun = outerRuns.find((run) => run.kind === 'h' && run.r === 0);
  const bottomRun = outerRuns.find((run) => run.kind === 'h' && run.r === rows);
  const leftRun = outerRuns.find((run) => run.kind === 'v' && run.c === 0);
  const rightRun = outerRuns.find((run) => run.kind === 'v' && run.c === cols);

  const sign = protrude ? -1 : 1;
  const top = edgeNotchPoints(topRun, grid, project, (u) => ({ x: u, y: 0 }), { x: 0, y: sign }, false);
  const right = edgeNotchPoints(rightRun, grid, project, (u) => ({ x: W, y: u }), { x: -sign, y: 0 }, false);
  const bottom = edgeNotchPoints(bottomRun, grid, project, (u) => ({ x: u, y: D }), { x: 0, y: -sign }, true);
  const left = edgeNotchPoints(leftRun, grid, project, (u) => ({ x: 0, y: u }), { x: sign, y: 0 }, true);

  return simplifyPolygon([...top, ...right, ...bottom, ...left]);
}

export function buildBasePlate(grid, project) {
  const runs = enumerateWallRuns(grid);
  const innerRuns = runs.filter((run) => !isOuterSegment(grid, run.kind, run.aPoint[0], run.aPoint[1]));

  return {
    id: 'base-plate',
    kind: 'basePlate',
    thicknessGroup: 'outer',
    thicknessMm: project.outerThicknessMm,
    outline: buildOuterEdgeOutline(grid, project),
    holes: dividerFingerHoles(innerRuns, grid, project),
  };
}
