// The coordinate mapping between a Notch's own canonical space
// (offsetMm/depthMm, growing from an anchor corner — see Notch.js's own
// movedBy/resizedToward, modeled on a wall's own free/top edge) and a
// piece's real (x,y) mm space, generalized to every edge orientation a grip
// notch can sit on: a wall's own free/top edge (axis x, boundary the wall's
// own local height, which VARIES along the edge), a wall's own END edge or
// a flat panel's (base plate/lid) own open side (axis x or y depending on
// which, boundary a CONSTANT — either 0 or the edge's own perpendicular
// extent). Derived directly from Panel.js's own alongX/alongY and
// FlatPanel.js's own nominalPointAt/inwardDirection (see ooNotchFrame.test.js
// for the cross-check against both, one case per real orientation).
//
// `frame` is `{ axis: 'x'|'y', zeroBoundary: boolean }` — which real axis
// carries the notch's own `u` (offsetMm/widthMm), and whether depth is
// measured OUTWARD from a 0 boundary (a wall's own leftEdge-field end, or a
// flat panel's own top/left side — `zeroBoundary: true`) or INWARD from a
// non-zero boundary (a wall's own free/top edge or rightEdge-field end, or
// a flat panel's own bottom/right side — `zeroBoundary: false`). The
// boundary's own numeric value (0 when zeroBoundary, otherwise the wall's
// own local height at the notch's center, or the flat edge's own
// perpendicular extent) is resolved ONCE by the caller — held fixed for a
// whole render/gesture, exactly like Notch.resizedToward's own
// `localHeightMm` parameter — and passed in here as a plain number, never
// re-derived per corner.
function realPointAt(frame, boundaryMm, uMm, depthMm) {
  const boundary = frame.zeroBoundary ? 0 : boundaryMm;
  const depthReal = frame.zeroBoundary ? depthMm : boundary - depthMm;
  return frame.axis === 'x' ? { x: uMm, y: depthReal } : { x: depthReal, y: uMm };
}

/** The notch's own anchor corner (offsetMm, zero depth) and free corner
 *  (offsetMm+widthMm, full depthMm), both in real piece-local mm space —
 *  the diagonal defining the notch's own rect, in whichever corner order
 *  `frame` happens to put them (never assumed to be top-left/bottom-right;
 *  callers normalize into a rect via min/max of the two). */
export function frameCorners(frame, boundaryMm, notch) {
  return {
    anchor: realPointAt(frame, boundaryMm, notch.offsetMm, 0),
    free: realPointAt(frame, boundaryMm, notch.offsetMm + notch.widthMm, notch.depthMm),
  };
}

/** The inverse of realPointAt: a real piece-local (x,y) point, converted
 *  into the canonical `{x, y, localHeightMm}` shape Notch.resizedToward
 *  already expects for its own `targetPoint`/`localHeightMm` params (and
 *  `.x` alone is what a move-drag's own delta is computed from — see
 *  NotchDragOverlay.js). */
export function frameToCanonical(frame, boundaryMm, x, y) {
  const u = frame.axis === 'x' ? x : y;
  const depthReal = frame.axis === 'x' ? y : x;
  const localHeightMm = frame.zeroBoundary ? 0 : boundaryMm;
  const canonicalY = frame.zeroBoundary ? -depthReal : depthReal;
  return { x: u, y: canonicalY, localHeightMm };
}
