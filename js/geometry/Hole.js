// A user-placed "trou" (hole): a rectangle, optionally corner-rounded,
// fully enclosed inside a piece's own local (x,y) space — never anchored
// to an edge (unlike a grip notch, GripNotch.js, which is always cut into
// a wall's own free edge). Both x and y are entirely free, so this applies
// uniformly to ANY flat piece (wall, base plate, lid, and their drawer
// equivalents), each of which already builds its own outline/holes in a
// consistent local (x,y) space — see PanelBuilder.buildWallPanel (x = u
// along the run's length, y = v up from the base plate line) and
// BasePlateBuilder/LidBuilder (x/y = the grid's own width/depth axes,
// origin at xAt/yAt's (0,0)).
//
// A piece can have SEVERAL — project.pieceHoles[pieceId] is a list, same
// shape as project.pieceNotches (GripNotch.notchListFor), just with no
// legacy single-object shape to normalize away since this field is new.
const ARC_SEGMENTS_PER_CORNER = 8; // 9 points per corner arc, 36 total for a fully-rounded rectangle

export const DEFAULT_HOLE = { xMm: 20, yMm: 10, widthMm: 20, heightMm: 15, radiusMm: 0 };

/** Both of a hole's dimensions are free (neither is pinned to an edge the
 *  way a grip notch's depth is), so its corner radius caps at half the
 *  SMALLER of the two — beyond that the two arcs on the short axis would
 *  have to overlap. */
export function maxRadiusMm(hole) {
  return Math.max(0, Math.min(hole.widthMm, hole.heightMm) / 2);
}

export function holeListFor(pieceHoles, pieceId) {
  return (pieceHoles && pieceHoles[pieceId]) || [];
}

/** Replaces the hole at `index` on `pieceId` with itself merged with
 *  `patch`, without mutating `pieceHoles` or any of its arrays (undo relies
 *  on every stored project state being a distinct snapshot). Shared by the
 *  text-field editor (HoleEditor.js) and the mouse-drag overlay
 *  (HoleDragOverlay.js) so both commit through identical, tested logic. */
export function setHoleAt(pieceHoles, pieceId, index, patch) {
  const list = holeListFor(pieceHoles, pieceId).map((h, i) => (i === index ? { ...h, ...patch } : h));
  return { ...pieceHoles, [pieceId]: list };
}

/** A moved copy of `hole`, offset by (dxMm,dyMm) — takes the ORIGINAL hole
 *  (the one at drag-start), not an already-moved one, so a caller
 *  recomputing the delta from the drag's start on every pointermove never
 *  accumulates rounding drift. */
export function moveHoleBy(hole, dxMm, dyMm) {
  return { ...hole, xMm: hole.xMm + dxMm, yMm: hole.yMm + dyMm };
}

/** A resized copy of `hole` whose xMm/yMm corner stays fixed while the
 *  opposite corner is dragged toward `targetPoint` ({x,y}, in the hole's
 *  own local mm space) — each axis floors independently at `minSizeMm` so
 *  dragging past the anchor corner can't invert or zero out the hole. */
export function resizeHoleToward(hole, targetPoint, minSizeMm) {
  return {
    ...hole,
    widthMm: Math.max(minSizeMm, targetPoint.x - hole.xMm),
    heightMm: Math.max(minSizeMm, targetPoint.y - hole.yMm),
  };
}

export function formatHoleLine(hole) {
  return [hole.xMm, hole.yMm, hole.widthMm, hole.heightMm, hole.radiusMm].join(', ');
}

/** null if the text isn't exactly 5 numbers — never a silent correction,
 *  never a half-parsed value applied (same discipline as GripNotch's
 *  parseNotchLine). */
export function parseHoleLine(text) {
  const parts = text.split(',').map((s) => s.trim());
  if (parts.length !== 5 || parts.some((p) => p === '')) return null;
  const nums = parts.map(Number);
  if (nums.some((n) => !Number.isFinite(n))) return null;
  const [xMm, yMm, widthMm, heightMm, radiusMm] = nums;
  return { xMm, yMm, widthMm, heightMm, radiusMm };
}

/** The hole's own closed polygon in the piece's local (x,y) space.
 *  radius<=0: the plain 4 rectangle corners, wound bottom-left ->
 *  bottom-right -> top-right -> top-left — the same order every other
 *  rectangular hole in this codebase already uses (PanelBuilder.mortiseHoles,
 *  BasePlateBuilder.dividerFingerHoles), so BurnCorrection's shared
 *  outward-normal formula shrinks it inward, not outward.
 *  radius>0: each corner becomes its own quarter-circle fillet in that
 *  same rotational order, clamped defensively to maxRadiusMm so an
 *  over-large radius degenerates into a stadium/circle shape instead of
 *  self-intersecting. */
export function holePolygon(hole) {
  const { xMm, yMm, widthMm, heightMm } = hole;
  const x0 = xMm, y0 = yMm, x1 = xMm + widthMm, y1 = yMm + heightMm;
  const r = Math.min(Math.max(hole.radiusMm || 0, 0), maxRadiusMm(hole));

  if (r <= 1e-9) {
    return [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
  }

  const corners = [
    { cx: x0 + r, cy: y0 + r, start: 180 }, // bottom-left
    { cx: x1 - r, cy: y0 + r, start: 270 }, // bottom-right
    { cx: x1 - r, cy: y1 - r, start: 0 },   // top-right
    { cx: x0 + r, cy: y1 - r, start: 90 },  // top-left
  ];
  const points = [];
  for (const { cx, cy, start } of corners) {
    for (let i = 0; i <= ARC_SEGMENTS_PER_CORNER; i++) {
      const rad = ((start + (90 * i) / ARC_SEGMENTS_PER_CORNER) * Math.PI) / 180;
      points.push({ x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) });
    }
  }
  return points;
}
