// A system-generated hole (TrouDeMortaise in the plan) receiving a
// FingerEdge's own teeth where they poke into the MIDDLE of another
// Panel's face rather than along its boundary edge (a T junction: this
// run's own end is a stem, see GridQuery.junctionKindAt) — always
// rectangular, one hole per 'finger' segment of the stem's own end comb,
// generated directly from the SAME FingerJoint.fingerEdgePath call the
// stem's own end edge uses, so a hole can never drift out of sync with
// the tenon meant to sit in it.
//
// Deliberately NOT a Cutout subclass — see HalfLapNotch.js's own comment;
// same reasoning, never user-authored.
export class MortiseHole {
  constructor({ xMm, yMm, widthMm, heightMm }) {
    this.xMm = xMm;
    this.yMm = yMm;
    this.widthMm = widthMm;
    this.heightMm = heightMm;
  }

  /** Wound bottom-left -> bottom-right -> top-right -> top-left, matching
   *  every other rectangular hole in this codebase (Hole.polygon()) so
   *  BurnCorrection's shared outward-normal formula shrinks it, not
   *  grows it. */
  polygon() {
    const x0 = this.xMm, y0 = this.yMm, x1 = this.xMm + this.widthMm, y1 = this.yMm + this.heightMm;
    return [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
  }

  /** One MortiseHole per 'finger' segment of `segments` (a
   *  FingerJoint.fingerEdgePath-shaped list — either a stem's own end
   *  comb tiled along its height for a T junction, or a divider's own
   *  bottom comb tiled along its length for the base plate's divider
   *  holes — both are "some run's own finger tiling, read by whoever
   *  receives it"). `axis` says which of the receiving Panel's own axes
   *  `segments` tiles along: `'y'` (default, the T-junction case) tiles
   *  segment start/length into Y with a `thicknessMm`-wide band centered
   *  on `centerMm` in X; `'x'` is the transposed case (the base plate's
   *  own divider holes for a horizontal run, where the tiling runs along
   *  X instead). `offsetMm` shifts the tiling axis's own origin (e.g. a
   *  divider run's own start position within the base plate's full W/D). */
  static manyFromFingerSegments(segments, { axis = 'y', centerMm, thicknessMm, offsetMm = 0 }) {
    const half = thicknessMm / 2;
    return segments
      .filter((s) => s.kind === 'finger')
      .map((s) => (axis === 'y'
        ? new MortiseHole({ xMm: centerMm - half, yMm: offsetMm + s.start, widthMm: thicknessMm, heightMm: s.length })
        : new MortiseHole({ xMm: offsetMm + s.start, yMm: centerMm - half, widthMm: s.length, heightMm: thicknessMm })));
  }
}
