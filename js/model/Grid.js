// Fixed-index grid-of-lines model. sx/sy (mm) define a lattice of
// (cols+1) x (rows+1) grid points, exactly like boxes.py's TrayLayout.
//
// vWalls[c][r]  = vertical wall segment between grid points (c,r)-(c,r+1)
//                 c in [0..cols], r in [0..rows-1]
// hWalls[c][r]  = horizontal wall segment between grid points (c,r)-(c+1,r)
//                 c in [0..cols-1], r in [0..rows]
// floors[c][r]  = whether cell (c,r) has a floor, c in [0..cols-1], r in [0..rows-1]
//
// A fixed lattice (vs. arbitrary line positions) means "what's incident at
// this point" is always an O(1) array lookup, never a floating-point
// coincidence search — that's the whole point of this data model.

function defaultSegment(isOuter) {
  return { present: true, heightMm: null, thicknessGroup: isOuter ? 'outer' : 'inner' };
}

export function createGrid(sxMm, syMm) {
  const cols = sxMm.length;
  const rows = syMm.length;

  const vWalls = [];
  for (let c = 0; c <= cols; c++) {
    const col = [];
    for (let r = 0; r < rows; r++) col.push(defaultSegment(c === 0 || c === cols));
    vWalls.push(col);
  }

  const hWalls = [];
  for (let c = 0; c < cols; c++) {
    const col = [];
    for (let r = 0; r <= rows; r++) col.push(defaultSegment(r === 0 || r === rows));
    hWalls.push(col);
  }

  const floors = [];
  for (let c = 0; c < cols; c++) {
    const col = [];
    for (let r = 0; r < rows; r++) col.push({ present: true });
    floors.push(col);
  }

  return { sx: sxMm.slice(), sy: syMm.slice(), vWalls, hWalls, floors };
}

export function cloneGrid(grid) {
  return JSON.parse(JSON.stringify(grid));
}

export function xAt(grid, c) {
  let x = 0;
  for (let i = 0; i < c; i++) x += grid.sx[i];
  return x;
}

export function yAt(grid, r) {
  let y = 0;
  for (let i = 0; i < r; i++) y += grid.sy[i];
  return y;
}

export function isOuterSegment(grid, kind, c, r) {
  return kind === 'v' ? c === 0 || c === grid.sx.length : r === 0 || r === grid.sy.length;
}

/** Toggles a segment's presence. Outer-perimeter segments can't be removed
 *  (they define the box's footprint) — the toggle is a no-op for those. */
export function toggleWall(grid, kind, c, r) {
  const next = cloneGrid(grid);
  const arr = kind === 'v' ? next.vWalls[c] : next.hWalls[c];
  const seg = arr[r];
  if (isOuterSegment(next, kind, c, r)) return next;
  seg.present = !seg.present;
  return next;
}

/** Sets one segment's height override. If the segment is on the outer
 *  perimeter, propagates to every outer segment so the perimeter stays a
 *  single consistent height (needed for the lid to sit on a flat rim) —
 *  this is a model invariant, not a UI-side validation step. */
export function setSegmentHeight(grid, kind, c, r, heightMm) {
  const next = cloneGrid(grid);
  if (isOuterSegment(next, kind, c, r)) {
    for (const col of next.vWalls) for (const seg of col) if (seg.thicknessGroup === 'outer') seg.heightMm = heightMm;
    for (const col of next.hWalls) for (const seg of col) if (seg.thicknessGroup === 'outer') seg.heightMm = heightMm;
  } else {
    const arr = kind === 'v' ? next.vWalls[c] : next.hWalls[c];
    arr[r].heightMm = heightMm;
  }
  return next;
}

export function setSegmentThicknessGroup(grid, kind, c, r, thicknessGroup) {
  const next = cloneGrid(grid);
  if (isOuterSegment(next, kind, c, r)) return next; // outer segments are always 'outer'
  const arr = kind === 'v' ? next.vWalls[c] : next.hWalls[c];
  arr[r].thicknessGroup = thicknessGroup;
  return next;
}

export function toggleFloor(grid, c, r) {
  const next = cloneGrid(grid);
  next.floors[c][r].present = !next.floors[c][r].present;
  return next;
}
