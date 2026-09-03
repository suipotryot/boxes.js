// A toothed (finger-joint) edge: tiled by FingerJoint.fingerEdgePath, with
// a magnitude of `mateThicknessMm` toward the mate at every 'finger'
// segment and 0 (flush, this edge's own nominal line) at every 'flush'/
// 'space' segment. Two FingerEdge instances facing each other need no
// reference to one another — opposite `startWithFinger` plus each other's
// own thickness (each already knows the OTHER's, never its own — see the
// plan's "épaisseur du partenaire, jamais la sienne propre") is provably
// enough: fingerEdgePath computes segment boundaries/widths identically
// regardless of startWithFinger (see FingerJoint.js), it only relabels
// which segments are 'finger' vs 'space' — so two opposite-phase instances
// are guaranteed complementary by construction, not by convention.
import { Edge } from './Edge.js';
import { fingerEdgePath } from '../FingerJoint.js';

/** Merges the outermost flush margin into its neighboring tooth at each
 *  end, so the last tooth reaches this edge's own physical tip instead of
 *  leaving a flush gap right at a box corner. Only meaningful where BOTH
 *  pieces meeting at a point terminate there (a corner) — never for a
 *  divider's own end, which always lands on a tenon/mortise instead (see
 *  GridQuery.junctionKindAt). */
function extendSegmentsToTips(segs) {
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

/** Forces the FIRST and LAST segment to 'finger' UNCONDITIONALLY,
 *  regardless of their own actual kind — distinct from extendSegmentsToTips
 *  above (which only merges when the adjacent segment already IS a
 *  finger). Used only for a flush lid's own free edge (PanelBuilder.
 *  lidTopEdgePoints' `atEnd` rule): the wall's two physical extremities
 *  must always reach the lid's own top face there, even on a phase where
 *  the comb's own first/last alternating segment happens to be a 'space'
 *  (this is NOT hypothetical — verified empirically: an 'h' run always has
 *  startWithFinger=false, so BOTH its own margin-adjacent segments are
 *  'space', meaning extendSegmentsToTips would leave both physical ends
 *  flush there — but the lid still needs to reach them). Without this,
 *  the free edge would dip below the lid's top face right at the corner
 *  it shares with this run's own end-comb — the exact class of bug that
 *  originally motivated this refactor (see the plan's own Contexte). */
function forceEndsToFinger(segs) {
  if (segs.length === 0) return segs;
  const result = segs.slice();
  result[0] = { ...result[0], kind: 'finger' };
  result[result.length - 1] = { ...result[result.length - 1], kind: 'finger' };
  return result;
}

/** Tiles [0, lengthMm] the same way FingerJoint.fingerEdgePath alone
 *  would, EXCEPT split into independent portions around each of
 *  `exclusions` ({uStart,uEnd}[], already sorted) — a plain flush strip
 *  at each exclusion itself, each stretch between/around them getting its
 *  own centered/maximal comb. Ported from PanelBuilder.bottomCombSegments:
 *  a run touched mid-length by a T/X junction reads as several short
 *  independent combs, not one long comb that happens to skip a bit — so a
 *  junction never has a tooth landing on or straddling it. */
function tileWithExclusions(lengthMm, fingerJoint, startWithFinger, exclusions) {
  if (exclusions.length === 0) return fingerEdgePath(lengthMm, fingerJoint, startWithFinger);

  const segs = [];
  let cursor = 0;
  for (const ex of exclusions) {
    const exStart = Math.max(ex.uStart, cursor);
    const exEnd = Math.max(ex.uEnd, exStart);
    if (exStart > cursor) {
      for (const s of fingerEdgePath(exStart - cursor, fingerJoint, startWithFinger)) {
        segs.push({ start: cursor + s.start, length: s.length, kind: s.kind });
      }
    }
    if (exEnd > exStart) segs.push({ start: exStart, length: exEnd - exStart, kind: 'flush' });
    cursor = exEnd;
  }
  if (lengthMm > cursor) {
    for (const s of fingerEdgePath(lengthMm - cursor, fingerJoint, startWithFinger)) {
      segs.push({ start: cursor + s.start, length: s.length, kind: s.kind });
    }
  }
  return segs;
}

export class FingerEdge extends Edge {
  constructor({
    lengthMm, fingerJoint, startWithFinger, mateThicknessMm, extendToTips = false,
    forceEndsToFinger: forceEnds = false, baselineMm = 0, signMm = 1, exclusions = [], fragments,
  }) {
    super(lengthMm, fragments);
    this.fingerJoint = fingerJoint; // {fingerMm, spaceMm, marginMm, playMm} — shared project-wide setting
    this.startWithFinger = startWithFinger;
    this.mateThicknessMm = mateThicknessMm; // the MATE's own thickness, never this edge's own
    this.extendToTips = extendToTips;
    // Unconditional variant of extendToTips — see forceEndsToFinger's own
    // comment. Mutually meaningful together (a lid-flush case never also
    // needs extendToTips — see Assembly.js's own wiring) but not mutually
    // exclusive here; forceEndsToFinger simply runs after extendToTips.
    this.forceEnds = forceEnds;
    // Mid-run "no teeth here" zones (a T/X junction crossing THIS edge's
    // own length partway along it) — see tileWithExclusions above. Empty
    // for an edge with nothing crossing it (or one tiled along a height
    // axis, e.g. a wall's own end edges, which never have this).
    this.exclusions = exclusions;
    // Where a Panel places this edge decides the final coordinate this
    // edge's own "0 or mateThicknessMm" value needs to land at — e.g. a
    // wall's bottom edge protrudes DOWN from y=0 (baselineMm=0, signMm=-1)
    // while its right end protrudes OUTWARD past x=lengthMm
    // (baselineMm=lengthMm, signMm=+1). Keeping this in the Edge's own
    // construction (decided once, by whichever role the caller is
    // building it for) keeps Panel.outline() itself a single uniform
    // per-slot rule instead of 4 independently hand-signed edge builders.
    this.baselineMm = baselineMm;
    this.signMm = signMm;
  }

  segments() {
    let segs = tileWithExclusions(this.lengthMm, this.fingerJoint, this.startWithFinger, this.exclusions);
    if (this.extendToTips) segs = extendSegmentsToTips(segs);
    if (this.forceEnds) segs = forceEndsToFinger(segs);
    return segs;
  }

  ownBoundaries() {
    return this.segments().flatMap((s) => [s.start, s.start + s.length]);
  }

  baseValueAt(u) {
    const seg = this.segments().find((s) => u > s.start && u < s.start + s.length);
    const protrusion = seg && seg.kind === 'finger' ? this.mateThicknessMm : 0;
    return this.baselineMm + this.signMm * protrusion;
  }
}
