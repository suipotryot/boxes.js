// Shared axis-alignment math for a piece's cutouts (Hole, Notch) — the
// "center" and "distribute" buttons in HoleEditor.js/GripNotchEditor.js.
// Pure list-in/list-out functions, parameterized by getStart/getSize/
// setStart so they work for any axis-aligned cutout regardless of its own
// field names — Hole (free xMm/yMm) and Notch (offsetMm, pinned to its own
// edge) both go through the identical, tested logic here. Index-order
// preserving (a click never reshuffles which UI row is which cutout — only
// positions change). Centering treats every cutout independently;
// distributing is the one that actually reasons about the group (sorted
// order, extremes fixed, middle ones spaced evenly) — see each function's
// own header comment.
/** Centers each cutout on its OWN axis, independently of every other one —
 *  NOT as a group: two cutouts don't keep whatever spacing they had before,
 *  each one's own center simply lands on availableSizeMm/2. (The margin
 *  used elsewhere for edge validation plays no role here: centering a
 *  size-wide span at (availableSizeMm-size)/2 already leaves equal room on
 *  both sides by construction — a cutout too big to leave the required
 *  margin surfaces as the usual validation warning afterward, same as any
 *  other alignment action.)
 *
 *  `availableSizeMmOrGetter` is either a plain number (the common case —
 *  every cutout on the piece shares the same available span) or a
 *  `(cutout) => number` getter, needed for a wall's Y axis: its local
 *  height can step along its length (a T-junction stub), so each hole may
 *  need centering against a DIFFERENT height — see HoleEditor.js's own call
 *  site. */
function resolveAvailableSizeMm(availableSizeMmOrGetter, cutout) {
  return typeof availableSizeMmOrGetter === 'function' ? availableSizeMmOrGetter(cutout) : availableSizeMmOrGetter;
}

export function centerOnAxis(cutouts, availableSizeMmOrGetter, getSize, setStart) {
  return cutouts.map((c) => setStart(c, (resolveAvailableSizeMm(availableSizeMmOrGetter, c) - getSize(c)) / 2));
}

/** Sorts cutouts by their own start position on the given axis, leaves the
 *  first and last exactly where they are, and repositions every
 *  in-between one so the gap between consecutive edges (start of one to
 *  end of the previous) is identical everywhere — never touching the two
 *  extremes' own position or size. A no-op below 3 cutouts: with 0-2 there
 *  is nothing "in the middle" to distribute. */
export function distributeOnAxis(cutouts, getStart, getSize, setStart) {
  if (cutouts.length < 3) return cutouts;

  const order = cutouts.map((_, i) => i).sort((a, b) => getStart(cutouts[a]) - getStart(cutouts[b]));
  const firstIdx = order[0];
  const lastIdx = order[order.length - 1];
  const middleIdxs = order.slice(1, -1);

  const first = cutouts[firstIdx];
  const last = cutouts[lastIdx];
  const innerSpanMm = getStart(last) - (getStart(first) + getSize(first));
  const middleSizeSumMm = middleIdxs.reduce((sum, i) => sum + getSize(cutouts[i]), 0);
  const gapMm = (innerSpanMm - middleSizeSumMm) / (order.length - 1);

  const result = cutouts.slice();
  let cursor = getStart(first) + getSize(first) + gapMm;
  for (const i of middleIdxs) {
    result[i] = setStart(cutouts[i], cursor);
    cursor += getSize(cutouts[i]) + gapMm;
  }
  return result;
}
