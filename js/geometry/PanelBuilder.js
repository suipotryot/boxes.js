// Builds one wall RUN's flat-pattern outline — a run is a maximal chain of
// contiguous, same-thickness-group grid cells (GridQuery.enumerateWallRuns),
// so a plain undivided side of the box is one physical piece, not one per
// grid cell it happens to span, and heights can vary along it without
// splitting it (a stepped profile), since only a genuine gap (a removed
// cell) or a thickness-group change is a real physical break. A local
// (u,v) rectangle where u runs along the run's length and v runs up its
// height, with:
//   - the two ends combed to interlock with whatever they meet there (end
//     junctions — corners, or a run whose *own* end lands at a T), using
//     the *local* height of whichever cell sits at that end;
//   - the free edge (opposite the base plate) stepped to each covered
//     cell's own resolved height;
//   - the bottom combed into the base plate;
//   - a mortise hole wherever a *stem* run's end lands mid-span (a T
//     junction where THIS run is the through-piece);
//   - a half-lap notch wherever a perpendicular run passes fully through
//     mid-span (an X crossing), sized to *half of the shorter of the two
//     crossing pieces' local heights* — never either piece's own height
//     in isolation, or the two notches wouldn't be complementary when the
//     heights differ (see splitHeight() below).
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

// Per-cell resolved height along the run's own u axis, ascending. Even a
// perfectly uniform run gets exactly one span here — the general edge
// builders below degrade to the old flat/simple behavior for free.
function heightProfile(run, grid, project) {
  const spans = [];
  if (run.kind === 'v') {
    for (let r = run.rStart; r <= run.rEnd; r++) {
      spans.push({
        uStart: yAt(grid, r) - yAt(grid, run.rStart),
        uEnd: yAt(grid, r + 1) - yAt(grid, run.rStart),
        height: resolveHeight(grid.vWalls[run.c][r], project),
      });
    }
  } else {
    for (let c = run.cStart; c <= run.cEnd; c++) {
      spans.push({
        uStart: xAt(grid, c) - xAt(grid, run.cStart),
        uEnd: xAt(grid, c + 1) - xAt(grid, run.cStart),
        height: resolveHeight(grid.hWalls[c][run.r], project),
      });
    }
  }
  return spans;
}

// The height in effect at position `u`. At an exact span boundary — the
// rare case of a crossing landing exactly on this run's own height step —
// this resolves to the *shorter* of the two touching spans, not
// arbitrarily "the one before": the notch/hole logic below is only
// physically sound if it's always working from the more conservative
// (shorter) height on offer at that exact point, same as splitHeight()
// does for the other axis.
function heightAt(spans, u, epsilon = 1e-9) {
  let min = Infinity;
  for (const s of spans) if (u >= s.uStart - epsilon && u <= s.uEnd + epsilon) min = Math.min(min, s.height);
  return min === Infinity ? spans[spans.length - 1].height : min;
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

// The u-extent (width) of a half-lap notch: wide enough to receive the
// *other* piece's full thickness, centered on the crossing.
function notchURange(crossing, project) {
  const halfWidth = resolveThickness(crossing.seg, project) / 2;
  return { uStart: crossing.u - halfWidth, uEnd: crossing.u + halfWidth };
}

// The perpendicular run's local height at a crossing point — the shorter
// of its *two* touching cells (crossing.segs), not arbitrarily just one:
// a height step on the *other* run can land exactly on this same point
// (both runs' steps can coincide, since neither run's merging cares about
// the other's heights at all), and using only one side there silently
// ignores whichever cell the caller didn't happen to pick.
function otherHeightAt(crossing, project) {
  return Math.min(...crossing.segs.map((s) => resolveHeight(s, project)));
}

// The height a half-lap notch is sized from: the SHORTER of the two
// crossing pieces' local heights at this exact position — never either
// piece's own height taken alone. If both pieces were notched to half of
// their *own* height, unequal heights would either overlap (both keep
// material in the middle) or leave a gap (neither reaches the top) at the
// crossing; splitting the shorter piece's own full extent in half, and
// using that same split for the taller piece too, is the only way both
// notches stay complementary — together spanning exactly the shorter
// piece's height, nothing more. Above that (only possible for the taller
// piece), there is nothing to interlock with, so that piece stays solid.
function splitHeight(crossing, spans, project) {
  const ownHeight = heightAt(spans, crossing.u);
  return Math.min(ownHeight, otherHeightAt(crossing, project));
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
  const excludeRanges = crossings.map((c) => notchURange(c, project));
  return clipSegmentsExcluding(raw, excludeRanges);
}

// Bottom edge (v=0), combed along u (length) into the base plate, with
// notches removed wherever this run notches from the bottom at an X
// crossing (see buildWallPanel: 'h' runs notch from the bottom, 'v' runs
// from the top — never both from the same side, or the two crossing
// pieces would collide instead of interlocking). A bottom notch always
// stays a true edge notch (open at v=0) regardless of relative height,
// since v=0 is this run's own real edge either way — unlike the free
// edge (see buildWallPanel), which can turn into an enclosed hole when
// this run is the taller of the two.
function bottomEdgePoints({ run, grid, project, spans, mateHalfThickness, notchesFromBottom }) {
  const events = [];
  if (mateHalfThickness > 0) {
    for (const s of bottomCombSegments(run, grid, project, notchesFromBottom)) {
      events.push({ uStart: s.start, uEnd: s.start + s.length, y: s.kind === 'finger' ? -mateHalfThickness : 0 });
    }
  } else {
    events.push({ uStart: 0, uEnd: run.length, y: 0 });
  }
  if (notchesFromBottom) {
    for (const c of interiorCrossings(run, grid)) {
      if (c.type !== 'through') continue;
      const { uStart, uEnd } = notchURange(c, project);
      const half = splitHeight(c, spans, project) / 2;
      events.push({ uStart, uEnd, y: half });
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

// The free edge (v=height, opposite the base plate): stepped to each
// covered cell's own resolved height, additionally notched down wherever
// this run notches from this side at an X crossing AND is the shorter (or
// equal) of the two crossing pieces there — `notches` only ever contains
// those; the "this run is taller" case is a separate enclosed hole (see
// buildWallPanel's freeEdgeHoles), not part of this edge at all.
function freeEdgePoints(run, spans, notches) {
  const boundarySet = new Set([0, run.length]);
  for (const s of spans) { boundarySet.add(s.uStart); boundarySet.add(s.uEnd); }
  for (const n of notches) { boundarySet.add(n.uStart); boundarySet.add(n.uEnd); }
  const boundaries = [...boundarySet].sort((a, b) => a - b);

  const pts = [];
  for (let i = 0; i < boundaries.length - 1; i++) {
    const uStart = boundaries[i];
    const uEnd = boundaries[i + 1];
    if (uEnd <= uStart) continue;
    const mid = (uStart + uEnd) / 2;
    let y = heightAt(spans, mid);
    const notch = notches.find((n) => mid > n.uStart && mid < n.uEnd);
    if (notch) y -= notch.depth;
    pts.push({ x: uStart, y }, { x: uEnd, y });
  }
  return pts.reverse(); // the free edge traverses length -> 0
}

// The enclosed half-lap holes for X crossings where THIS run is the
// *taller* of the two crossing pieces at that position: the shorter
// piece's own top half needs to slot in somewhere strictly inside this
// run's height, not at this run's own top edge, so it's a hole through
// the face, not a boundary notch. Point order verified empirically to
// shrink (not grow) under BurnCorrection's shared outward-normal formula,
// same discipline as every other hole in this codebase.
function freeEdgeHoles(crossings, spans, project) {
  const holes = [];
  for (const c of crossings) {
    const ownHeight = heightAt(spans, c.u);
    const otherHeight = otherHeightAt(c, project);
    if (ownHeight <= otherHeight) continue; // handled as an edge notch instead
    const { uStart, uEnd } = notchURange(c, project);
    const half = otherHeight / 2;
    holes.push([
      { x: uStart, y: half },
      { x: uEnd, y: half },
      { x: uEnd, y: otherHeight },
      { x: uStart, y: otherHeight },
    ]);
  }
  return holes;
}

// Mortise holes for T junctions where THIS run is the through-piece: one
// closed hole per 'finger' segment of the stem's *own* end comb (same
// fingerEdgePath(stemHeight, fj, stemStartWithFinger) a stem run's own
// endEdgePoints will use for that end), so a hole can never drift out of
// sync with the tenon meant to sit in it. Width is the stem's own
// thickness (a physical footprint, not a mating protrusion). The stem's
// own height is read directly off its grid cell, independent of whether
// *our* run's height varies elsewhere.
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
  const fj = project.fingerJoint;
  const spans = heightProfile(run, grid, project);
  const heightA = spans[0].height;
  const heightB = spans[spans.length - 1].height;

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

  const throughCrossings = interiorCrossings(run, grid).filter((c) => c.type === 'through');
  const freeEdgeNotches = notchesFromBottom ? [] : throughCrossings
    .filter((c) => heightAt(spans, c.u) <= otherHeightAt(c, project))
    .map((c) => ({ ...notchURange(c, project), depth: splitHeight(c, spans, project) / 2 }));
  const freeHoles = notchesFromBottom ? [] : freeEdgeHoles(throughCrossings, spans, project);

  const bottom = bottomEdgePoints({ run, grid, project, spans, mateHalfThickness: baseHalf, notchesFromBottom });
  const right = endEdgePoints({ length, height: heightB, mateHalfThickness: halfB, fj, startWithFinger, atRight: true, reverse: false });
  const top = freeEdgePoints(run, spans, freeEdgeNotches);
  const left = endEdgePoints({ length, height: heightA, mateHalfThickness: halfA, fj, startWithFinger, atRight: false, reverse: true });

  const outline = simplifyPolygon([...bottom, ...right, ...top, ...left]);

  return {
    id: `wall-${kind}-${aPoint[0]}-${aPoint[1]}`,
    kind: 'wall',
    thicknessGroup: seg.thicknessGroup,
    thicknessMm: resolveThickness(seg, project),
    outline,
    holes: [...mortiseHoles(run, grid, project), ...freeHoles],
  };
}
