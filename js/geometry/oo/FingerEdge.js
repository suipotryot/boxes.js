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

export class FingerEdge extends Edge {
  constructor({
    lengthMm, fingerJoint, startWithFinger, mateThicknessMm, extendToTips = false,
    baselineMm = 0, signMm = 1, fragments,
  }) {
    super(lengthMm, fragments);
    this.fingerJoint = fingerJoint; // {fingerMm, spaceMm, marginMm, playMm} — shared project-wide setting
    this.startWithFinger = startWithFinger;
    this.mateThicknessMm = mateThicknessMm; // the MATE's own thickness, never this edge's own
    this.extendToTips = extendToTips;
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
    const segs = fingerEdgePath(this.lengthMm, this.fingerJoint, this.startWithFinger);
    return this.extendToTips ? extendSegmentsToTips(segs) : segs;
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
