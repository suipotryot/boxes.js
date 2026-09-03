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

  /** One MortiseHole per 'finger' segment of `segments` (a direct
   *  FingerJoint.fingerEdgePath(stemHeight, fj, stemStartWithFinger)
   *  call — the stem's own end comb, tiled along ITS height), centered
   *  on `centerMm` (the crossing's u position along the receiving run's
   *  own length) with a width equal to the stem's own thickness. */
  static manyFromFingerSegments(segments, centerMm, stemThicknessMm) {
    const half = stemThicknessMm / 2;
    return segments
      .filter((s) => s.kind === 'finger')
      .map((s) => new MortiseHole({ xMm: centerMm - half, yMm: s.start, widthMm: stemThicknessMm, heightMm: s.length }));
  }
}
