// A "grip notch" (encoche pour doigt): a user-placed cutout always anchored
// to a wall run's own FREE edge (v = its own top — see PanelBuilder.js's
// freeEdgePoints/lidTopEdgePoints, the only two functions that build that
// edge). Defined by width/depth/offset (from the run's own u=0 end) plus a
// single corner-radius field: 0 gives a flat-bottomed rectangular notch,
// and radius === min(width/2, depth) gives the most rounded shape possible
// for that width/depth — a full semicircle specifically when depth also
// equals width/2. One continuous parameterization, not a shape toggle.
const ARC_SEGMENTS_PER_CORNER = 8; // 9 points per fully-rounded corner; 16 total when both corners meet a shared point

export const DEFAULT_GRIP_NOTCH = { enabled: false, widthMm: 30, depthMm: 15, offsetMm: 10, radiusMm: 0 };

export function maxRadiusMm(notch) {
  return Math.max(0, Math.min(notch.widthMm / 2, notch.depthMm));
}

/** {uStart, uEnd, points:[{u,y}...]} in the run's own local space, for
 *  splicing into PanelBuilder's boundarySet+override edge builders.
 *  radius<=0: 2 points (a flat floor) — the notch's own 2 vertical walls
 *  appear implicitly from the "jump" against the un-notched point on
 *  either side, exactly like the existing X-crossing notch mechanism.
 *  radius>0: a quarter-circle fillet at each bottom corner (center
 *  `radius` in from that corner), with a flat floor between them only
 *  when radius < width/2 — otherwise the two fillets meet at the exact
 *  center with no flat stretch left. When radius also equals depth (its
 *  own other cap), the fillet's own top point lands exactly at
 *  localHeight, i.e. the vertical wall's length is zero — the fillet
 *  starts right at the un-notched edge. Both caps maxed out at once
 *  (radius = width/2 = depth) is what makes this degenerate into a full
 *  semicircle — a limit of this one formula, not a separate branch. */
export function gripNotchOverride(notch, localHeight) {
  if (!notch || !notch.enabled) return null;
  const { widthMm, offsetMm, depthMm } = notch;
  const uStart = offsetMm, uEnd = offsetMm + widthMm;
  const floor = localHeight - depthMm;
  const radius = Math.min(Math.max(notch.radiusMm || 0, 0), maxRadiusMm(notch));

  if (radius <= 1e-9) {
    return { uStart, uEnd, points: [{ u: uStart, y: floor }, { u: uEnd, y: floor }] };
  }

  const arcPoint = (cu, cy, deg) => {
    const rad = (deg * Math.PI) / 180;
    return { u: cu + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  };
  const points = [];
  for (let i = 0; i <= ARC_SEGMENTS_PER_CORNER; i++) {
    points.push(arcPoint(uStart + radius, floor + radius, 180 + (90 * i) / ARC_SEGMENTS_PER_CORNER));
  }
  if (uEnd - radius > uStart + radius + 1e-9) points.push({ u: uEnd - radius, y: floor });
  for (let i = 0; i <= ARC_SEGMENTS_PER_CORNER; i++) {
    points.push(arcPoint(uEnd - radius, floor + radius, 270 + (90 * i) / ARC_SEGMENTS_PER_CORNER));
  }
  return { uStart, uEnd, points };
}
