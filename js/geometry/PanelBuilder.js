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
//   - the bottom combed into the base plate, per PORTION between interior
//     junctions rather than across the run's whole length at once — no
//     finger ever lands on or straddles a junction point (X or T alike),
//     see bottomCombSegments();
//   - a mortise hole wherever a *stem* run's end lands mid-span (a T
//     junction where THIS run is the through-piece);
//   - a half-lap notch wherever a perpendicular run passes fully through
//     mid-span (an X crossing): h = min(x1, x2, y1, y2) across the four
//     local heights touching the crossing (this run's own two touching
//     spans and the perpendicular run's own two touching spans); both
//     pieces always notch to exactly h/2 — the 'h' run from the floor up,
//     the 'v' run from h/2 up to its own top edge — symmetric regardless
//     of which piece is taller. See crossingNotchDepth().
//
// Central convention (write once, reference everywhere — this exact
// omission is what causes underdepth/half-thickness bugs): a wall's tab
// protrudes past its own centerline by *the mate's full* thickness, never
// half of it — a mortise hole is always cut all the way through the piece
// that receives it (a laser cuts through the entire sheet, there is no
// such thing as a half-depth hole), so a tab meant to fill that hole flush
// must reach the mate's far face regardless of where the mate's own
// centerline sits. Every edge builder in this file uses the mate's
// resolved thickness (resolveThickness/maxThickness) directly instead of
// re-deriving a protrusion depth.
import { fingerEdgePath } from './FingerJoint.js';
import { simplifyPolygon } from './Point.js';
import { resolveThickness, resolveHeight, perpendicularMatesAtPoint, crossingAt, perimeterHeight, xAt, yAt } from '../model/GridQuery.js';

/** A wall run's piece id — the one stable place this format is defined,
 *  so anything that needs to find a run's own piece again later (e.g. the
 *  editor highlighting the preview piece for whatever grid line is
 *  currently selected, via GridQuery.runAt) never has to re-derive or
 *  duplicate the format itself. */
export function wallPieceId(run) {
  return `wall-${run.kind}-${run.aPoint[0]}-${run.aPoint[1]}`;
}

function maxThickness(mates, project) {
  return mates.length ? Math.max(...mates.map((m) => resolveThickness(m, project))) : 0;
}

// fingerEdgePath centers its comb, leaving a flush margin on BOTH ends —
// fine for a joint where the margin sits against more of the same run
// (T-junction stems, dividers), but at an outer-wall box corner the two
// meeting walls use opposite startWithFinger phases, so one of them ends
// its comb on a 'finger' right before that trailing/leading margin (an
// odd total tooth-slot count always favors one phase by exactly one
// tooth — see FingerJoint.fingerEdgePath). Leaving that margin as flush
// means the piece with more teeth still tapers off to a plain, un-toothed
// edge at its own two extremities — the box's actual outer corners, the
// most exposed points structurally. Outer walls always share one height
// (Grid.setSegmentHeight propagates it), so this is purely a phase
// artifact, not a real size mismatch — extend that adjacent tooth to
// consume the margin instead, reaching flush to the piece's own end.
// Never applied to interior dividers (their own ends land on a T/X
// junction, not a box corner — no such "outer corner" concept applies).
function extendEndTeethToTips(segs) {
  const result = segs.slice();
  if (result.length >= 2 && result[0].kind === 'flush' && result[1].kind === 'finger') {
    result[1] = { start: 0, length: result[1].length + result[0].length, kind: 'finger' };
    result.shift();
  }
  const n = result.length;
  if (n >= 2 && result[n - 1].kind === 'flush' && result[n - 2].kind === 'finger') {
    result[n - 2] = { ...result[n - 2], length: result[n - 2].length + result[n - 1].length };
    result.pop();
  }
  return result;
}

// One end edge (u=0 or u=length), combed along v (height). `atRight`
// selects which end; `reverse` flips point order so the caller can compose
// a non-self-intersecting outline (the left end must run top->bottom while
// every other edge runs the other way — getting this backwards is exactly
// the double-reversal bug that produced self-intersecting outlines before).
function endEdgePoints({ length: L, height: H, mateProtrusion, fj, startWithFinger, atRight, reverse, extendToTips }) {
  const baseU = atRight ? L : 0;
  const dir = atRight ? 1 : -1;
  let pts;
  if (mateProtrusion <= 0) {
    pts = [{ x: baseU, y: 0 }, { x: baseU, y: H }];
  } else {
    let segs = fingerEdgePath(H, fj, startWithFinger);
    if (extendToTips) segs = extendEndTeethToTips(segs);
    pts = [];
    for (const seg of segs) {
      const u = seg.kind === 'finger' ? baseU + dir * mateProtrusion : baseU;
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
        uStart: yAt(grid, project, r) - yAt(grid, project, run.rStart),
        uEnd: yAt(grid, project, r + 1) - yAt(grid, project, run.rStart),
        height: resolveHeight(grid.vWalls[run.c][r], project),
      });
    }
  } else {
    for (let c = run.cStart; c <= run.cEnd; c++) {
      spans.push({
        uStart: xAt(grid, project, c) - xAt(grid, project, run.cStart),
        uEnd: xAt(grid, project, c + 1) - xAt(grid, project, run.cStart),
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
function interiorCrossings(run, grid, project) {
  const results = [];
  if (run.kind === 'v') {
    for (let r = run.rStart + 1; r <= run.rEnd; r++) {
      const info = crossingAt(grid, 'v', run.c, r);
      if (info.type === 'none') continue;
      results.push({ u: yAt(grid, project, r) - yAt(grid, project, run.rStart), ...info });
    }
  } else {
    for (let c = run.cStart + 1; c <= run.cEnd; c++) {
      const info = crossingAt(grid, 'h', c, run.r);
      if (info.type === 'none') continue;
      results.push({ u: xAt(grid, project, c) - xAt(grid, project, run.cStart), ...info });
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

// The u-extent (width) of the "no teeth here" zone at any interior
// crossing — X or T alike, per the user's own rule: a junction point
// always gets a plain flush strip, wide enough to clear whatever crosses
// it, never a finger straddling or landing right against it. 'through'
// (X) reuses the half-lap notch's own width (the crossing perpendicular
// piece's thickness); 'stems' (T) uses the thickest of the one or two
// stems present there (mirrors maxThickness's own "widest mate wins"
// convention elsewhere in this file).
function crossingExclusionRange(crossing, project) {
  if (crossing.type === 'through') return notchURange(crossing, project);
  const halfWidth = maxThickness(crossing.stems, project) / 2;
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

// A half-lap notch's floor, as an ABSOLUTE height from this piece's own
// designated edge's baseline (v=0 for 'h' runs, which notch from the
// floor; the free edge's own coordinate space for 'v' runs, which notch
// from the top — see buildWallPanel and freeEdgePoints). Per the user's
// own spec: h = min(x1, x2, y1, y2), the shortest of the four local
// heights touching the crossing (this run's own two touching spans, and
// the perpendicular run's own two touching spans) — both pieces always
// notch to exactly h/2, symmetric, regardless of which piece is taller.
// `ownHeight`/`otherHeight` here are already each the min of their own
// pair (heightAt's boundary tie-break, and otherHeightAt), so their min
// is h across all four. This value is applied as an absolute override,
// not subtracted from either side's own height — that distinction is
// what produces a correct U shape when a run's own two touching spans
// differ (a height step coinciding with the crossing): both sides get
// the same h/2 floor, only the open top above it differs per side.
function crossingNotchDepth(crossing, spans, project) {
  const ownHeight = heightAt(spans, crossing.u);
  const otherHeight = otherHeightAt(crossing, project);
  return Math.min(ownHeight, otherHeight) / 2;
}

/** The bottom-edge comb segments for a run, reasoned per PORTION rather
 *  than across the whole run at once: the run's length is split into
 *  independent stretches at every interior crossing (X or T alike, see
 *  crossingExclusionRange), each stretch gets its own centered/maximal
 *  fingerEdgePath tiling, and the crossing's own u-range in between is
 *  left a plain flush strip — so a junction never has a finger landing on
 *  or straddling it, and a long run with several junctions reads as
 *  several short combs rather than one that happens to get interrupted.
 *  Exported so BasePlateBuilder can carve divider finger holes from
 *  *this exact* segmentation — the same single-source-of-truth
 *  discipline as fingerEdgePath itself, so a base plate hole can never
 *  drift out of sync with the tabs (or their absence at a junction) it's
 *  meant to receive. */
export function bottomCombSegments(run, grid, project) {
  const fj = project.fingerJoint;
  const startWithFinger = run.kind === 'v';
  const crossings = interiorCrossings(run, grid, project).filter((c) => c.type !== 'none');
  if (crossings.length === 0) return fingerEdgePath(run.length, fj, startWithFinger);

  const exclusions = crossings
    .map((c) => crossingExclusionRange(c, project))
    .sort((a, b) => a.uStart - b.uStart);

  const segs = [];
  let cursor = 0;
  for (const ex of exclusions) {
    const exStart = Math.max(ex.uStart, cursor);
    const exEnd = Math.max(ex.uEnd, exStart);
    if (exStart > cursor) {
      for (const s of fingerEdgePath(exStart - cursor, fj, startWithFinger)) {
        segs.push({ start: cursor + s.start, length: s.length, kind: s.kind });
      }
    }
    if (exEnd > exStart) segs.push({ start: exStart, length: exEnd - exStart, kind: 'flush' });
    cursor = exEnd;
  }
  if (run.length > cursor) {
    for (const s of fingerEdgePath(run.length - cursor, fj, startWithFinger)) {
      segs.push({ start: cursor + s.start, length: s.length, kind: s.kind });
    }
  }
  return segs;
}

// Bottom edge (v=0), combed along u (length) into the base plate — per
// portion, with a plain flush strip at every interior junction (see
// bottomCombSegments) — additionally cut down to an absolute depth
// wherever this run notches from the bottom at an X crossing (see
// buildWallPanel: 'h' runs notch from the bottom, 'v' runs from the top
// — never both from the same side, or the two crossing pieces would
// collide instead of interlocking). The X-crossing depth OVERRIDES
// whatever the comb says at that same u-range (same override-not-combine
// pattern as freeEdgePoints, for the same reason: two independently
// authored events covering the same stretch must not both become
// separate point-pairs, or the outline doubles back on itself).
function bottomEdgePoints({ run, grid, project, spans, mateProtrusion, notchesFromBottom }) {
  const comb = mateProtrusion > 0
    ? bottomCombSegments(run, grid, project)
    : [{ start: 0, length: run.length, kind: 'flush' }];
  const notches = notchesFromBottom
    ? interiorCrossings(run, grid, project).filter((c) => c.type === 'through')
      .map((c) => ({ ...notchURange(c, project), depth: crossingNotchDepth(c, spans, project) }))
    : [];

  const boundarySet = new Set([0, run.length]);
  for (const s of comb) { boundarySet.add(s.start); boundarySet.add(s.start + s.length); }
  for (const n of notches) { boundarySet.add(n.uStart); boundarySet.add(n.uEnd); }
  const boundaries = [...boundarySet].sort((a, b) => a - b);

  const pts = [];
  for (let i = 0; i < boundaries.length - 1; i++) {
    const uStart = boundaries[i];
    const uEnd = boundaries[i + 1];
    if (uEnd <= uStart) continue;
    const mid = (uStart + uEnd) / 2;
    const notch = notches.find((n) => mid > n.uStart && mid < n.uEnd);
    let y;
    if (notch) {
      y = notch.depth;
    } else {
      const seg = comb.find((s) => mid > s.start && mid < s.start + s.length);
      y = seg && seg.kind === 'finger' ? -mateProtrusion : 0;
    }
    pts.push({ x: uStart, y }, { x: uEnd, y });
  }
  return pts;
}

// The free edge (v=height, opposite the base plate): stepped to each
// covered cell's own resolved height, additionally cut down to an
// absolute floor of `notch.depth` (crossingNotchDepth — h/2 across all
// four local heights at the crossing) wherever this run notches from this
// side at an X crossing. This is an override, not a subtraction from the
// local height: when this run's own two touching spans differ (a height
// step coinciding with the crossing), both spans still get the exact same
// floor, only the open top on either side of the notch differs — the U
// shape the notch is meant to produce.
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
    const notch = notches.find((n) => mid > n.uStart && mid < n.uEnd);
    const y = notch ? notch.depth : heightAt(spans, mid);
    pts.push({ x: uStart, y }, { x: uEnd, y });
  }
  return pts.reverse(); // the free edge traverses length -> 0
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
  for (const crossing of interiorCrossings(run, grid, project)) {
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

// A fixed lid's own top-edge comb — replaces freeEdgePoints entirely for
// an OUTER run when the lid sits exactly flush with the perimeter height
// (see buildWallPanel): the wall's tabs protrude ABOVE its own nominal
// height at 'finger' positions (mirroring bottomEdgePoints' own tabs
// protruding BELOW v=0 into the base plate), interlocking with notches
// cut into the lid's own outline (BasePlateBuilder.buildOuterEdgeOutline
// — the lid and the base plate share that exact function, since a flush
// lid is geometrically the base plate's mirror image at the top). Outer
// runs are always a single uniform height and never have an X-crossing
// notch on their own free edge (a perimeter run can only ever meet a T
// junction, never an X — one side of any interior point along it is
// always out-of-grid), so this never needs to merge with freeEdgePoints'
// other concerns.
function lidTopEdgePoints(run, grid, project, height) {
  const protrusion = project.outerThicknessMm;
  const pts = [];
  for (const s of bottomCombSegments(run, grid, project)) {
    const y = s.kind === 'finger' ? height + protrusion : height;
    pts.push({ x: s.start, y }, { x: s.start + s.length, y });
  }
  return pts.reverse(); // match freeEdgePoints' length -> 0 traversal
}

// A fixed lid's row of mortise holes in an OUTER wall's face, for the
// RECESSED case (insertHeightMm < perimeter height, so the wall continues
// above the lid as a rim and its own free edge is left untouched). One
// hole per 'finger' segment of the *same* bottomCombSegments tiling the
// lid's own tabs use (BasePlateBuilder.buildOuterEdgeOutline with
// protrude:true), so a hole can never drift out of sync with the tab
// meant to sit in it — same single-source-of-truth discipline as every
// other hole in this file. Hole height (in v) is the lid's own thickness,
// ending exactly at insertHeightMm — the lid's *top* face, the same
// top-edge convention every other height field in this app already uses.
function lidHoles(run, grid, project, insertHeightMm, lidThicknessMm) {
  const top = insertHeightMm;
  const bottom = insertHeightMm - lidThicknessMm;
  const holes = [];
  for (const s of bottomCombSegments(run, grid, project)) {
    if (s.kind !== 'finger') continue;
    holes.push([
      { x: s.start, y: bottom },
      { x: s.start + s.length, y: bottom },
      { x: s.start + s.length, y: top },
      { x: s.start, y: top },
    ]);
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
  const protrusionA = maxThickness(matesA, project);
  const protrusionB = maxThickness(matesB, project);

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
  const baseProtrusion = hasBasePlate ? project.outerThicknessMm : 0;

  const throughCrossings = interiorCrossings(run, grid, project).filter((c) => c.type === 'through');
  const freeEdgeNotches = notchesFromBottom ? [] : throughCrossings
    .map((c) => ({ ...notchURange(c, project), depth: crossingNotchDepth(c, spans, project) }));

  // A fixed lid only ever joints with OUTER walls (see LidBuilder) — an
  // interior divider's own geometry is entirely unaffected by it.
  const lid = project.lid;
  const lidActive = !!lid && lid.enabled && lid.insertHeightMm != null && seg.thicknessGroup === 'outer';
  const lidFlush = lidActive && Math.abs(lid.insertHeightMm - perimeterHeight(grid, project)) < 1e-6;

  // Only outer walls' own corner combs get their end teeth stretched to
  // the tip (see extendEndTeethToTips) — a divider's own end always lands
  // on a T/X junction against another run, not a box corner, and outer
  // walls are the only runs guaranteed to always meet another same-height
  // outer run at both of their own ends.
  const extendToTips = seg.thicknessGroup === 'outer';

  const bottom = bottomEdgePoints({ run, grid, project, spans, mateProtrusion: baseProtrusion, notchesFromBottom });
  const right = endEdgePoints({ length, height: heightB, mateProtrusion: protrusionB, fj, startWithFinger, atRight: true, reverse: false, extendToTips });
  const top = lidFlush ? lidTopEdgePoints(run, grid, project, heightA) : freeEdgePoints(run, spans, freeEdgeNotches);
  const left = endEdgePoints({ length, height: heightA, mateProtrusion: protrusionA, fj, startWithFinger, atRight: false, reverse: true, extendToTips });

  const outline = simplifyPolygon([...bottom, ...right, ...top, ...left]);

  const holes = [
    ...mortiseHoles(run, grid, project),
    ...(lidActive && !lidFlush ? lidHoles(run, grid, project, lid.insertHeightMm, project.outerThicknessMm) : []),
  ];

  return {
    id: wallPieceId(run),
    kind: 'wall',
    thicknessGroup: seg.thicknessGroup,
    thicknessMm: resolveThickness(seg, project),
    outline,
    holes,
  };
}
