// A straight (un-toothed) edge: a flat line, or one that steps to follow a
// height profile — either way, no finger comb of its own. Notches (Notch
// instances turned into fragments — see Notch.toEdgeFragment) still solder
// into it via the shared Edge.points() merge.
import { Edge } from './Edge.js';

export class SmoothEdge extends Edge {
  constructor({ lengthMm, heightProfile, fragments }) {
    super(lengthMm, fragments);
    // Span[] {uStart, uEnd, height} — ALWAYS at least one entry covering
    // the full [0, lengthMm] range, even for a plain constant-height edge
    // (a single span). Never optional/nullable: one representation for
    // both the stepped and constant case, no branching on which applies.
    this.heightProfile = heightProfile;
  }

  ownBoundaries() {
    return this.heightProfile.flatMap((s) => [s.uStart, s.uEnd]);
  }

  /** The height in effect at u. At an exact span boundary, resolves to the
   *  SHORTER of the two touching spans — matching the pre-existing
   *  heightAt(spans, u) convention (a notch/hole check is only physically
   *  sound working from the more conservative height on offer there). */
  baseValueAt(u, epsilon = 1e-9) {
    let min = Infinity;
    for (const s of this.heightProfile) {
      if (u >= s.uStart - epsilon && u <= s.uEnd + epsilon) min = Math.min(min, s.height);
    }
    return min === Infinity ? this.heightProfile[this.heightProfile.length - 1].height : min;
  }
}
