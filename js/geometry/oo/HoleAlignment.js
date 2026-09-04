// Alignment for the holes on one piece — the "center on X/Y" and
// "distribute on X/Y" buttons in HoleEditor.js. Pure list-in/list-out
// functions, index-order preserving (a click never reshuffles which UI row
// is which hole — only positions change). Centering treats every hole
// independently (each one centers on its own); distributing is the one
// that actually reasons about the group (sorted order, extremes fixed,
// middle ones spaced evenly) — see each function's own header comment.
/** Centers each hole on its OWN axis, independently of every other hole —
 *  NOT as a group: two holes don't keep whatever spacing they had before,
 *  each one's own center simply lands on availableSizeMm/2. (The margin
 *  used elsewhere for edge validation plays no role here: centering a
 *  widthMm-wide span at (availableSizeMm-widthMm)/2 already leaves equal
 *  room on both sides by construction — a hole too big to leave the
 *  required margin surfaces as the usual validation warning afterward,
 *  same as any other alignment action.)
 *
 *  `availableSizeMmOrGetter` is either a plain number (the common case —
 *  every hole on the piece shares the same available span, e.g. any X
 *  axis, or a flat piece's Y axis) or a `(hole) => number` getter, needed
 *  for a wall's Y axis: its local height can step along its length (a
 *  T-junction stub), so each hole may need centering against a DIFFERENT
 *  height — see HoleEditor.js's own call site. */
function resolveAvailableSizeMm(availableSizeMmOrGetter, hole) {
  return typeof availableSizeMmOrGetter === 'function' ? availableSizeMmOrGetter(hole) : availableSizeMmOrGetter;
}

function centerOnAxis(holes, availableSizeMmOrGetter, getSize, setStart) {
  return holes.map((h) => setStart(h, (resolveAvailableSizeMm(availableSizeMmOrGetter, h) - getSize(h)) / 2));
}

/** Sorts holes by their own start position on the given axis, leaves the
 *  first and last exactly where they are, and repositions every
 *  in-between hole so the gap between consecutive edges (start of one to
 *  end of the previous) is identical everywhere — never touching the two
 *  extremes' own position or size. A no-op below 3 holes: with 0-2 holes
 *  there is nothing "in the middle" to distribute. */
function distributeOnAxis(holes, getStart, getSize, setStart) {
  if (holes.length < 3) return holes;

  const order = holes.map((_, i) => i).sort((a, b) => getStart(holes[a]) - getStart(holes[b]));
  const firstIdx = order[0];
  const lastIdx = order[order.length - 1];
  const middleIdxs = order.slice(1, -1);

  const first = holes[firstIdx];
  const last = holes[lastIdx];
  const innerSpanMm = getStart(last) - (getStart(first) + getSize(first));
  const middleSizeSumMm = middleIdxs.reduce((sum, i) => sum + getSize(holes[i]), 0);
  const gapMm = (innerSpanMm - middleSizeSumMm) / (order.length - 1);

  const result = holes.slice();
  let cursor = getStart(first) + getSize(first) + gapMm;
  for (const i of middleIdxs) {
    result[i] = setStart(holes[i], cursor);
    cursor += getSize(holes[i]) + gapMm;
  }
  return result;
}

const xStart = (h) => h.xMm;
const xSize = (h) => h.widthMm;
const setX = (h, xMm) => h.withChanges({ xMm });

const yStart = (h) => h.yMm;
const ySize = (h) => h.heightMm;
const setY = (h, yMm) => h.withChanges({ yMm });

export function centerHolesOnX(holes, availableWidthMm) {
  return centerOnAxis(holes, availableWidthMm, xSize, setX);
}

export function centerHolesOnY(holes, availableHeightMm) {
  return centerOnAxis(holes, availableHeightMm, ySize, setY);
}

export function distributeHolesOnX(holes) {
  return distributeOnAxis(holes, xStart, xSize, setX);
}

export function distributeHolesOnY(holes) {
  return distributeOnAxis(holes, yStart, ySize, setY);
}
