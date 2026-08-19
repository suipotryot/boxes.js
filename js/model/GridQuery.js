// Pure, read-only queries over a Grid. No geometry here — everything is an
// array lookup, which is the entire point of the fixed-lattice model.
import { xAt, yAt } from './Grid.js';

export function resolveThickness(segment, project) {
  return segment.thicknessGroup === 'outer' ? project.outerThicknessMm : project.innerThicknessMm;
}

export function resolveHeight(segment, project) {
  if (segment.heightMm != null) return segment.heightMm;
  return segment.thicknessGroup === 'outer' ? project.outerHeightMm : project.innerHeightMm;
}

/** Flat list of every present wall segment, with absolute endpoint coords. */
export function enumerateWallSegments(grid) {
  const cols = grid.sx.length;
  const rows = grid.sy.length;
  const segs = [];

  for (let c = 0; c <= cols; c++) {
    for (let r = 0; r < rows; r++) {
      const seg = grid.vWalls[c][r];
      if (!seg.present) continue;
      segs.push({
        kind: 'v', c, r, seg,
        a: { x: xAt(grid, c), y: yAt(grid, r) },
        b: { x: xAt(grid, c), y: yAt(grid, r + 1) },
        aPoint: [c, r], bPoint: [c, r + 1],
      });
    }
  }

  for (let c = 0; c < cols; c++) {
    for (let r = 0; r <= rows; r++) {
      const seg = grid.hWalls[c][r];
      if (!seg.present) continue;
      segs.push({
        kind: 'h', c, r, seg,
        a: { x: xAt(grid, c), y: yAt(grid, r) },
        b: { x: xAt(grid, c + 1), y: yAt(grid, r) },
        aPoint: [c, r], bPoint: [c + 1, r],
      });
    }
  }

  return segs;
}

/** The (up to 2) wall segments perpendicular to `wallKind` that are present
 *  at grid point (pointC,pointR) — i.e. what this wall's end must interlock
 *  with there. Never includes segments collinear with `wallKind` itself:
 *  two collinear pieces meeting at a point don't finger-joint against each
 *  other, they each independently joint against whatever crosses them. */
export function perpendicularMatesAtPoint(grid, wallKind, pointC, pointR) {
  const cols = grid.sx.length;
  const rows = grid.sy.length;
  const mates = [];

  if (wallKind === 'v') {
    if (pointC - 1 >= 0 && grid.hWalls[pointC - 1][pointR].present) mates.push(grid.hWalls[pointC - 1][pointR]);
    if (pointC < cols && grid.hWalls[pointC][pointR].present) mates.push(grid.hWalls[pointC][pointR]);
  } else {
    if (pointR - 1 >= 0 && grid.vWalls[pointC][pointR - 1].present) mates.push(grid.vWalls[pointC][pointR - 1]);
    if (pointR < rows && grid.vWalls[pointC][pointR].present) mates.push(grid.vWalls[pointC][pointR]);
  }
  return mates;
}

export function tallestInnerHeight(grid, project) {
  let max = 0;
  for (const col of grid.vWalls) for (const seg of col) if (seg.present && seg.thicknessGroup === 'inner') max = Math.max(max, resolveHeight(seg, project));
  for (const col of grid.hWalls) for (const seg of col) if (seg.present && seg.thicknessGroup === 'inner') max = Math.max(max, resolveHeight(seg, project));
  return max;
}

export function perimeterHeight(grid, project) {
  // Perimeter height is a model invariant (setSegmentHeight propagates it
  // uniformly), so any one outer segment carries it.
  for (const col of grid.vWalls) for (const seg of col) if (seg.thicknessGroup === 'outer') return resolveHeight(seg, project);
  return project.outerHeightMm;
}
