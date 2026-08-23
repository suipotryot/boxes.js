// A "grip notch" (encoche pour doigt): a user-placed cutout always anchored
// to a wall run's own FREE edge (v = its own top — see PanelBuilder.js's
// freeEdgePoints/lidTopEdgePoints, the only two functions that build that
// edge). Defined by width/depth/offset (from the run's own u=0 end) plus a
// single corner-radius field: 0 gives a flat-bottomed rectangular notch,
// and radius === min(width/2, depth) gives the most rounded shape possible
// for that width/depth — a full semicircle specifically when depth also
// equals width/2. One continuous parameterization, not a shape toggle.
//
// A piece can have several — project.pieceNotches[pieceId] is a LIST, not
// a single notch (a wall selected via different grid segments of the same
// merged run always resolves to the same piece id, so one notch per piece
// wasn't enough). There's deliberately no per-notch `enabled` flag: an
// unwanted notch is removed from the list outright, rather than kept
// around disabled — presence in the list IS "active".
const ARC_SEGMENTS_PER_CORNER = 8; // 9 points per fully-rounded corner; 16 total when both corners meet a shared point

export const DEFAULT_GRIP_NOTCH = { widthMm: 30, depthMm: 15, offsetMm: 10, radiusMm: 0 };

export function maxRadiusMm(notch) {
  return Math.max(0, Math.min(notch.widthMm / 2, notch.depthMm));
}

/** The list of grip notches configured for one piece — normalizing away
 *  two other shapes a stored value can legitimately have: absent (no
 *  entry yet) and the OLD single-object-with-`enabled` shape this feature
 *  shipped with before multiple notches per piece existed (kept readable
 *  rather than silently discarded, since real projects were already saved
 *  under that shape). A legacy object with `enabled:true` becomes a
 *  1-element list (its `enabled` field just rides along, unused); disabled
 *  or missing becomes an empty list. Always returns a real array, so every
 *  caller (geometry, validation, UI) can just .map()/.filter() it. */
export function notchListFor(pieceNotches, pieceId) {
  const stored = pieceNotches && pieceNotches[pieceId];
  if (Array.isArray(stored)) return stored;
  if (stored && stored.enabled) return [stored];
  return [];
}

// A single notch, edited as one "largeur, profondeur, rayon, position"
// line — compact (one field, not four) and directly copy/paste-able to
// duplicate a notch, rather than four separate inputs each needing their
// own copy. The comma is the separator between the 4 values; the decimal
// point stays `.` (never `,`) within a value, exactly like every other
// numeric field in this app already does under the hood — sidesteps the
// ambiguity a French decimal comma would otherwise create against the
// same character used to separate the 4 values.
export function formatNotchLine(notch) {
  return [notch.widthMm, notch.depthMm, notch.radiusMm, notch.offsetMm].join(', ');
}

/** null if the text isn't exactly 4 numbers — never a silent correction,
 *  never a half-parsed value applied. The caller (GripNotchEditor.js)
 *  keeps whatever the user typed on-screen without touching the stored
 *  notch when this returns null, rather than losing their input or
 *  applying garbage. */
export function parseNotchLine(text) {
  const parts = text.split(',').map((s) => s.trim());
  if (parts.length !== 4 || parts.some((p) => p === '')) return null;
  const nums = parts.map(Number);
  if (nums.some((n) => !Number.isFinite(n))) return null;
  const [widthMm, depthMm, radiusMm, offsetMm] = nums;
  return { widthMm, depthMm, radiusMm, offsetMm };
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
  if (!notch) return null;
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
