// One compass side's own FingerEdge config for a base plate/lid boundary
// (see Panel.js's own flatBoundaryOutline for how these 4 sides get
// assembled into one closed outline with fused corners — that used to live
// here too, as outerBoundaryOutline/sidePoints, until Panel absorbed it).

/** One compass side's FingerEdge, pre-configured so its own points() come
 *  out as a magnitude already in the right sign for its role: `protrude`
 *  false (base plate, flush lid) means finger recedes to the compartment
 *  boundary (val=0) and flush extends outward by `marginMm` (val=
 *  -marginMm); `protrude` true (recessed lid) is the reverse. `marginMm`
 *  is always the full outer thickness (a notch/tab always reaches or
 *  recedes the full material thickness, never half — the by-now-familiar
 *  rule already enforced everywhere else in this codebase). */
export function outerBoundarySide({ lengthMm, fingerJoint, startWithFinger, marginMm, protrude, exclusions, fragments }) {
  // Both cases share signMm=+1 — only the baseline shifts between them
  // (flush sits at -marginMm and finger reaches 0 when NOT protruding;
  // flush stays at 0 and finger reaches +marginMm when it does).
  const baselineMm = protrude ? 0 : -marginMm;
  return { lengthMm, fingerJoint, startWithFinger, mateThicknessMm: marginMm, baselineMm, signMm: 1, exclusions, fragments };
}
