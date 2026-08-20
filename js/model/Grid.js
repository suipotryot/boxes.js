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

export function toggleFloor(grid, c, r) {
  const next = cloneGrid(grid);
  next.floors[c][r].present = !next.floors[c][r].present;
  return next;
}

function segmentsEqual(a, b) {
  return a.present === b.present && a.heightMm === b.heightMm && a.thicknessGroup === b.thicknessGroup;
}

/** Resizes the grid to a new sx/sy. Outer-perimeter segments are always
 *  regenerated fresh (the perimeter invariant always wins, and a manual
 *  heightMm override on an outer segment is rare enough not to be worth
 *  preserving across a resize). Interior wall/floor customization is
 *  carried over wherever its (kind,c,r) position still exists *and* is
 *  still interior in the new grid; everywhere else a genuine
 *  customization is dropped. Returns { grid, lostCustomization } so the
 *  caller can warn before committing a resize that would silently drop
 *  existing edits. */
export function resizeGrid(grid, newSxMm, newSyMm) {
  const next = createGrid(newSxMm, newSyMm);
  const oldCols = grid.sx.length, oldRows = grid.sy.length;
  const newCols = newSxMm.length, newRows = newSyMm.length;
  let lostCustomization = false;

  for (let c = 0; c <= oldCols; c++) {
    for (let r = 0; r < oldRows; r++) {
      if (isOuterSegment(grid, 'v', c, r)) continue;
      const oldSeg = grid.vWalls[c][r];
      if (segmentsEqual(oldSeg, defaultSegment(false))) continue;
      const stillInner = c <= newCols && r < newRows && !isOuterSegment(next, 'v', c, r);
      if (stillInner) next.vWalls[c][r] = { ...oldSeg };
      else lostCustomization = true;
    }
  }

  for (let c = 0; c < oldCols; c++) {
    for (let r = 0; r <= oldRows; r++) {
      if (isOuterSegment(grid, 'h', c, r)) continue;
      const oldSeg = grid.hWalls[c][r];
      if (segmentsEqual(oldSeg, defaultSegment(false))) continue;
      const stillInner = c < newCols && r <= newRows && !isOuterSegment(next, 'h', c, r);
      if (stillInner) next.hWalls[c][r] = { ...oldSeg };
      else lostCustomization = true;
    }
  }

  for (let c = 0; c < oldCols; c++) {
    for (let r = 0; r < oldRows; r++) {
      if (grid.floors[c][r].present !== false) continue; // only a removed floor counts as customized
      const stillExists = c < newCols && r < newRows;
      if (stillExists) next.floors[c][r].present = false;
      else lostCustomization = true;
    }
  }

  return { grid: next, lostCustomization };
}
