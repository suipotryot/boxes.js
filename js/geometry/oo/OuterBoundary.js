// The box's W×D outer-perimeter outline (shared shape behind BasePlate and
// a flush/recessed Lid — see those files): 4 FingerEdge instances (one per
// compass side, any of which may be absent for an open side) assembled
// with their own margins merged at each corner. This is genuinely NOT the
// same assembly as Panel.outline() — a wall's 4 edges naturally meet at
// their own tips (each edge's own extendToTips), but here each side only
// knows its OWN axis's margin, so the diagonal corner point needs both
// adjacent sides' contributions combined explicitly, exactly like the
// pre-existing buildOuterEdgeOutline this ports.
import { simplifyPolygon } from '../Point.js';

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

/** Assembles top/right/bottom/left (each `{edge, axisPoint, inward}` or
 *  null for an open side with no run at all) into one closed outline.
 *  `axisPoint(u)` is the side's own nominal (untabbed) line; `inward` is
 *  the unit vector `edge`'s own magnitude is added along. Every side's
 *  own two endpoints are then snapped to the shared corner point (both
 *  adjacent sides' own margins merged into one diagonal point) rather
 *  than left at their own single-axis approximation — see
 *  outerBoundaryOutline's own caller for why a side with no run at all
 *  contributes 0 margin at its own corners. */
function sidePoints(side, reverse) {
  if (!side) return [];
  const { edge, axisPoint, inward } = side;
  const pts = edge.points().map(({ u, y: val }) => {
    const p = axisPoint(u);
    return { x: p.x + inward.x * val, y: p.y + inward.y * val };
  });
  return reverse ? pts.reverse() : pts;
}

/** `sides` keys: top/right/bottom/left, each `{edge, axisPoint, inward}`
 *  or null. `widthMm`/`depthMm` are the compartment's own W×D (the
 *  un-toothed nominal rectangle). `margins` gives each present side's own
 *  outward corner margin (0 for an absent side, or when `protrude`). */
export function outerBoundaryOutline(sides, widthMm, depthMm, margins) {
  const top = sidePoints(sides.top, false);
  const right = sidePoints(sides.right, false);
  const bottom = sidePoints(sides.bottom, true);
  const left = sidePoints(sides.left, true);

  const mLeft = sides.left ? margins.left : 0;
  const mRight = sides.right ? margins.right : 0;
  const mTop = sides.top ? margins.top : 0;
  const mBottom = sides.bottom ? margins.bottom : 0;
  const topLeft = { x: -mLeft, y: -mTop };
  const topRight = { x: widthMm + mRight, y: -mTop };
  const bottomRight = { x: widthMm + mRight, y: depthMm + mBottom };
  const bottomLeft = { x: -mLeft, y: depthMm + mBottom };
  if (top.length) { top[0] = topLeft; top[top.length - 1] = topRight; }
  if (right.length) { right[0] = topRight; right[right.length - 1] = bottomRight; }
  if (bottom.length) { bottom[0] = bottomRight; bottom[bottom.length - 1] = bottomLeft; }
  if (left.length) { left[0] = bottomLeft; left[left.length - 1] = topLeft; }

  return simplifyPolygon([...top, ...right, ...bottom, ...left]);
}
