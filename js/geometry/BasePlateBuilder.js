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
import { bottomCombSegments } from './PanelBuilder.js';
import { resolveThickness, enumerateWallRuns, xAt, yAt } from '../model/GridQuery.js';
import { isOuterSegment } from '../model/Grid.js';
import { holeListFor, holePolygon } from './Hole.js';

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
      const x = xAt(grid, project, run.c);
      const y0 = yAt(grid, project, run.rStart);
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
      const y = yAt(grid, project, run.r);
      const x0 = xAt(grid, project, run.cStart);
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

// `axisPoint(u)` sits exactly on the compartment boundary (xAt/yAt's own
// coordinate — where the outer wall's INNER face is, per the "walls
// entirely outward" convention).
//
// `protrude:false` (base plate, flush lid): a flush segment must NOT sit
// on that boundary — the plate's own true outer edge is
// `outerThicknessMm` further OUT (matching the wall's OUTER face — the
// same margin the wall panel's own corner combs already protrude past
// their nominal length into, see PanelBuilder's endEdgePoints/halfA-B),
// so a flush stretch of the plate extends out to meet it. A finger
// (tooth) segment recedes back to EXACTLY the compartment boundary —
// never past it — so the notch only ever cuts into the wall's own
// thickness margin, and the compartment's usable floor span (measured on
// the bare, unassembled plate, between two junctions) is the full
// nominal span the user configured, not that span minus a wall
// thickness.
//
// `protrude:true` (recessed lid): the reverse — a flush segment stays
// right on the compartment boundary (the lid's own nominal, un-tabbed
// span is exactly the compartment footprint), and a finger segment
// protrudes OUTWARD past it by the full outer thickness, reaching into
// the wall's own material to form a real tab.
function edgeNotchPoints(run, grid, project, axisPoint, inward, reverse, protrude) {
  if (!run) return [];
  const depthFull = project.outerThicknessMm;
  const pts = [];
  for (const s of bottomCombSegments(run, grid, project)) {
    const isFinger = s.kind === 'finger';
    const offset = protrude ? (isFinger ? depthFull : 0) : (isFinger ? 0 : -depthFull);
    const p0 = axisPoint(s.start);
    const p1 = axisPoint(s.start + s.length);
    pts.push({ x: p0.x + inward.x * offset, y: p0.y + inward.y * offset });
    pts.push({ x: p1.x + inward.x * offset, y: p1.y + inward.y * offset });
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
  const W = xAt(grid, project, cols);
  const D = yAt(grid, project, rows);

  const runs = enumerateWallRuns(grid, project);
  const outerRuns = runs.filter((run) => isOuterSegment(grid, run.kind, run.aPoint[0], run.aPoint[1]));
  const topRun = outerRuns.find((run) => run.kind === 'h' && run.r === 0);
  const bottomRun = outerRuns.find((run) => run.kind === 'h' && run.r === rows);
  const leftRun = outerRuns.find((run) => run.kind === 'v' && run.c === 0);
  const rightRun = outerRuns.find((run) => run.kind === 'v' && run.c === cols);

  const sign = protrude ? -1 : 1;
  const top = edgeNotchPoints(topRun, grid, project, (u) => ({ x: u, y: 0 }), { x: 0, y: sign }, false, protrude);
  const right = edgeNotchPoints(rightRun, grid, project, (u) => ({ x: W, y: u }), { x: -sign, y: 0 }, false, protrude);
  const bottom = edgeNotchPoints(bottomRun, grid, project, (u) => ({ x: u, y: D }), { x: 0, y: -sign }, true, protrude);
  const left = edgeNotchPoints(leftRun, grid, project, (u) => ({ x: 0, y: u }), { x: sign, y: 0 }, true, protrude);

  // Each edge only knows its OWN inward axis, so a flush (margin) segment
  // at an end only extends on that one axis — the box's actual corner
  // (both margins at once, a diagonal point) needs both adjacent edges'
  // contributions merged. Snap every edge's own two endpoints directly to
  // the true corner rather than leaving each at its own single-axis
  // approximation, which otherwise leaves a stray diagonal cut across the
  // corner (self-intersecting once the two near-duplicate points are
  // simplified together). `protrude:true` never extends past the nominal
  // rectangle at an end (fingers/tabs never land exactly at a corner
  // given a non-zero margin), so margin is 0 there.
  //
  // Margin is applied PER SIDE, not as one blanket value: a side with no
  // run at all (an open side — see Grid.setSegmentPresent, e.g. a drawer
  // sleeve box's omitted wall) has no wall material to extend outward
  // for, so it gets 0 margin — the plate/lid stops exactly at the nominal
  // W/D boundary there (flush with whatever sits just inside it), rather
  // than overhanging by outerThicknessMm the way a real wall's own
  // corner would. For the main box every side always has a run, so this
  // is identical to the old single blanket-margin behavior there — this
  // only ever differs when a side is genuinely open.
  const margin = protrude ? 0 : project.outerThicknessMm;
  const mLeft = leftRun ? margin : 0;
  const mRight = rightRun ? margin : 0;
  const mTop = topRun ? margin : 0;
  const mBottom = bottomRun ? margin : 0;
  const topLeft = { x: -mLeft, y: -mTop };
  const topRight = { x: W + mRight, y: -mTop };
  const bottomRight = { x: W + mRight, y: D + mBottom };
  const bottomLeft = { x: -mLeft, y: D + mBottom };
  if (top.length) { top[0] = topLeft; top[top.length - 1] = topRight; }
  if (right.length) { right[0] = topRight; right[right.length - 1] = bottomRight; }
  if (bottom.length) { bottom[0] = bottomRight; bottom[bottom.length - 1] = bottomLeft; }
  if (left.length) { left[0] = bottomLeft; left[left.length - 1] = topLeft; }

  return simplifyPolygon([...top, ...right, ...bottom, ...left]);
}

export function buildBasePlate(grid, project) {
  const runs = enumerateWallRuns(grid, project);
  const innerRuns = runs.filter((run) => !isOuterSegment(grid, run.kind, run.aPoint[0], run.aPoint[1]));

  return {
    id: 'base-plate',
    kind: 'basePlate',
    thicknessGroup: 'outer',
    thicknessMm: project.outerThicknessMm,
    outline: buildOuterEdgeOutline(grid, project),
    holes: [
      ...dividerFingerHoles(innerRuns, grid, project),
      ...holeListFor(project.pieceHoles, 'base-plate').map(holePolygon),
    ],
  };
}
