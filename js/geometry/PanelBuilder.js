// Builds one wall RUN's flat-pattern outline — a run is a maximal chain of
// contiguous, identically-customized grid cells (GridQuery.enumerateWallRuns),
// so a plain undivided side of the box is one physical piece, not one per
// grid cell it happens to span. A local (u,v) rectangle where u runs along
// the run's length and v runs up its height, with:
//   - the two ends combed to interlock with whatever they meet there (end
//     junctions — corners, or a run whose *own* end lands at a T);
//   - the bottom combed into the base plate;
//   - a mortise hole wherever a *stem* run's end lands mid-span (a T
//     junction where THIS run is the through-piece);
//   - a half-lap notch wherever a perpendicular run passes fully through
//     mid-span (an X crossing).
//
// Central convention (write once, reference everywhere — this exact
// omission is what causes half-thickness/overshoot bugs): a wall's tab
// protrudes past its own centerline by *the mate's* thickness / 2, never
// its own thickness. See matingProtrusion() below; every edge builder in
// this file goes through it instead of re-deriving a protrusion depth.
import { fingerEdgePath } from './FingerJoint.js';
import { simplifyPolygon } from './Point.js';
import { resolveThickness, resolveHeight, perpendicularMatesAtPoint, crossingAt } from '../model/GridQuery.js';
import { xAt, yAt } from '../model/Grid.js';

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

// Any interior grid point of `run` where something perpendicular touches —
// mid-run, never at the run's own two ends. `u` is that point's distance
// along the run's own length axis from its start.
function interiorCrossings(run, grid) {
  const results = [];
  if (run.kind === 'v') {
    for (let r = run.rStart + 1; r <= run.rEnd; r++) {
      const info = crossingAt(grid, 'v', run.c, r);
      if (info.type === 'none') continue;
      results.push({ u: yAt(grid, r) - yAt(grid, run.rStart), ...info });
    }
  } else {
    for (let c = run.cStart + 1; c <= run.cEnd; c++) {
      const info = crossingAt(grid, 'h', c, run.r);
      if (info.type === 'none') continue;
      results.push({ u: xAt(grid, c) - xAt(grid, run.cStart), ...info });
    }
  }
  return results;
}

// The half-lap notch's footprint on ONE of the two crossing pieces: wide
// enough (along u) to receive the *other* piece's full thickness, deep
// enough (into v, from whichever edge this piece notches from) to remove
// exactly half of THIS piece's own height — so when both pieces' notches
// meet, together they fill the full height with no overlap and no gap.
function notchRange(crossing, ownHeightMm, project) {
  const halfWidth = resolveThickness(crossing.seg, project) / 2;
  return { uStart: crossing.u - halfWidth, uEnd: crossing.u + halfWidth, depth: ownHeightMm / 2 };
}

// Splits `segments` (as from fingerEdgePath) so none of them overlap
// `excludeRanges` — used to keep the base-plate finger comb out of a
// bottom-notched X crossing's footprint (the material there has been
// notched away, so there is nothing left to comb). Ranges are assumed
// sorted and non-overlapping, same as the segments.
function clipSegmentsExcluding(segments, excludeRanges) {
  if (excludeRanges.length === 0) return segments;
  const out = [];
  for (const seg of segments) {
    let start = seg.start;
    const end = seg.start + seg.length;
    for (const ex of excludeRanges) {
      if (ex.uEnd <= start || ex.uStart >= end) continue;
      if (ex.uStart > start) out.push({ start, length: ex.uStart - start, kind: seg.kind });
      start = Math.max(start, ex.uEnd);
    }
    if (end > start) out.push({ start, length: end - start, kind: seg.kind });
  }
  return out;
}

/** The bottom-edge comb segments for a run, already clipped to exclude any
 *  bottom-notched X-crossing footprint. Exported so BasePlateBuilder can
 *  carve divider finger holes from *this exact* segmentation — the same
 *  single-source-of-truth discipline as fingerEdgePath itself, so a base
 *  plate hole can never drift out of sync with the tabs (or their absence
 *  at a crossing) it's meant to receive. */
export function bottomCombSegments(run, grid, project, notchesFromBottom) {
  const fj = project.fingerJoint;
  const startWithFinger = run.kind === 'v';
  const raw = fingerEdgePath(run.length, fj, startWithFinger);
  if (!notchesFromBottom) return raw;
  const crossings = interiorCrossings(run, grid).filter((c) => c.type === 'through');
  if (crossings.length === 0) return raw;
  const height = resolveHeight(run.seg, project);
  const excludeRanges = crossings.map((c) => notchRange(c, height, project));
  return clipSegmentsExcluding(raw, excludeRanges);
}

// Bottom edge (v=0), combed along u (length) into the base plate, with
// notches removed wherever this run notches from the bottom at an X
// crossing (see buildWallPanel: 'h' runs notch from the bottom, 'v' runs
// from the top — never both from the same side, or the two crossing
// pieces would collide instead of interlocking).
function bottomEdgePoints({ run, grid, project, mateHalfThickness, notchesFromBottom }) {
  const events = [];
  if (mateHalfThickness > 0) {
    for (const s of bottomCombSegments(run, grid, project, notchesFromBottom)) {
      events.push({ uStart: s.start, uEnd: s.start + s.length, y: s.kind === 'finger' ? -mateHalfThickness : 0 });
    }
  } else {
    events.push({ uStart: 0, uEnd: run.length, y: 0 });
  }
  if (notchesFromBottom) {
    const height = resolveHeight(run.seg, project);
    for (const c of interiorCrossings(run, grid)) {
      if (c.type !== 'through') continue;
      const n = notchRange(c, height, project);
      events.push({ uStart: n.uStart, uEnd: n.uEnd, y: n.depth });
    }
    events.sort((a, b) => a.uStart - b.uStart);
  }
  const pts = [];
  for (const e of events) {
    pts.push({ x: e.uStart, y: e.y });
    pts.push({ x: e.uEnd, y: e.y });
  }
  return pts;
}

// Top edge (v=height), normally a flat line, notched down toward
// mid-height wherever this run notches from the top at an X crossing.
function topEdgePoints(run, grid, project, height, notchesFromTop) {
  if (!notchesFromTop) return [{ x: run.length, y: height }, { x: 0, y: height }];
  const crossings = interiorCrossings(run, grid).filter((c) => c.type === 'through');
  if (crossings.length === 0) return [{ x: run.length, y: height }, { x: 0, y: height }];
  const notches = crossings.map((c) => notchRange(c, height, project));
  const pts = [];
  let u = 0;
  for (const n of notches) {
    if (n.uStart > u) pts.push({ x: u, y: height }, { x: n.uStart, y: height });
    pts.push({ x: n.uStart, y: height - n.depth }, { x: n.uEnd, y: height - n.depth });
    u = n.uEnd;
  }
  if (u < run.length) pts.push({ x: u, y: height }, { x: run.length, y: height });
  return pts.reverse(); // top edge traverses length -> 0
}

// Mortise holes for T junctions where THIS run is the through-piece: one
// closed hole per 'finger' segment of the stem's *own* end comb (same
// fingerEdgePath(stemHeight, fj, stemStartWithFinger) a stem run's own
// endEdgePoints will use for that end), so a hole can never drift out of
// sync with the tenon meant to sit in it. Width is the stem's own
// thickness (a physical footprint, not a mating protrusion).
function mortiseHoles(run, grid, project) {
  const fj = project.fingerJoint;
  const stemStartWithFinger = run.kind === 'h';
  const holes = [];
  for (const crossing of interiorCrossings(run, grid)) {
    if (crossing.type !== 'stems') continue;
    for (const stemSeg of crossing.stems) {
      const stemHeight = resolveHeight(stemSeg, project);
      const half = resolveThickness(stemSeg, project) / 2;
      for (const fs of fingerEdgePath(stemHeight, fj, stemStartWithFinger)) {
        if (fs.kind !== 'finger') continue;
        holes.push([
          { x: crossing.u - half, y: fs.start },
          { x: crossing.u + half, y: fs.start },
          { x: crossing.u + half, y: fs.start + fs.length },
          { x: crossing.u - half, y: fs.start + fs.length },
        ]);
      }
    }
  }
  return holes;
}

/**
 * @param {object} run one entry from GridQuery.enumerateWallRuns()
 * @param {object} grid
 * @param {object} project
 * @param {boolean} hasBasePlate whether this run's bottom combs into a floor
 */
export function buildWallPanel(run, grid, project, hasBasePlate) {
  const { kind, aPoint, bPoint, seg, length } = run;
  const height = resolveHeight(seg, project);
  const fj = project.fingerJoint;

  const matesA = perpendicularMatesAtPoint(grid, kind, aPoint[0], aPoint[1]);
  const matesB = perpendicularMatesAtPoint(grid, kind, bPoint[0], bPoint[1]);
  const halfA = matingProtrusion(maxThickness(matesA, project));
  const halfB = matingProtrusion(maxThickness(matesB, project));

  // Axis-based convention guarantees complementary alternation between any
  // two mates without needing a per-pair tie-break: a 'v' run's ends and
  // its bottom edge always lead with a finger; the 'h'/base-plate mates it
  // interlocks with always lead with a space, by construction of this rule
  // applying uniformly to every run. The same axis split decides which
  // side an X crossing notches from — 'v' from the top, 'h' from the
  // bottom — so the two crossing pieces always remove complementary
  // halves, never the same one (which would collide instead of interlock).
  const startWithFinger = kind === 'v';
  const notchesFromBottom = kind === 'h';
  const baseHalf = hasBasePlate ? matingProtrusion(project.outerThicknessMm) : 0;

  const bottom = bottomEdgePoints({ run, grid, project, mateHalfThickness: baseHalf, notchesFromBottom });
  const right = endEdgePoints({ length, height, mateHalfThickness: halfB, fj, startWithFinger, atRight: true, reverse: false });
  const top = topEdgePoints(run, grid, project, height, !notchesFromBottom);
  const left = endEdgePoints({ length, height, mateHalfThickness: halfA, fj, startWithFinger, atRight: false, reverse: true });

  const outline = simplifyPolygon([...bottom, ...right, ...top, ...left]);

  return {
    id: `wall-${kind}-${aPoint[0]}-${aPoint[1]}`,
    kind: 'wall',
    thicknessGroup: seg.thicknessGroup,
    thicknessMm: resolveThickness(seg, project),
    outline,
    holes: mortiseHoles(run, grid, project),
  };
}
