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

/** Maximal runs of contiguous, identically-customized present segments
 *  along one grid line — this is what actually gets cut as one physical
 *  piece. Two adjacent present cells only merge into one run if they
 *  share the same heightMm and thicknessGroup; a genuine per-segment
 *  customization still produces a real break, but the common case (no
 *  customization at all, or a whole divider set uniformly) merges into
 *  a single piece instead of one piece per grid cell. The outer
 *  perimeter is always exactly one run per side by construction — outer
 *  segments can never be removed and Grid.setSegmentHeight always
 *  propagates height to the whole perimeter together, so they can never
 *  disagree. */
export function enumerateWallRuns(grid) {
  const cols = grid.sx.length;
  const rows = grid.sy.length;
  const runs = [];
  const sameCustomization = (a, b) => a.heightMm === b.heightMm && a.thicknessGroup === b.thicknessGroup;

  for (let c = 0; c <= cols; c++) {
    let r = 0;
    while (r < rows) {
      const seg = grid.vWalls[c][r];
      if (!seg.present) { r++; continue; }
      let rEnd = r;
      while (rEnd + 1 < rows && grid.vWalls[c][rEnd + 1].present && sameCustomization(grid.vWalls[c][rEnd + 1], seg)) rEnd++;
      runs.push({
        kind: 'v', c, rStart: r, rEnd, seg,
        aPoint: [c, r], bPoint: [c, rEnd + 1],
        length: yAt(grid, rEnd + 1) - yAt(grid, r),
      });
      r = rEnd + 1;
    }
  }

  for (let r = 0; r <= rows; r++) {
    let c = 0;
    while (c < cols) {
      const seg = grid.hWalls[c][r];
      if (!seg.present) { c++; continue; }
      let cEnd = c;
      while (cEnd + 1 < cols && grid.hWalls[cEnd + 1][r].present && sameCustomization(grid.hWalls[cEnd + 1][r], seg)) cEnd++;
      runs.push({
        kind: 'h', r, cStart: c, cEnd, seg,
        aPoint: [c, r], bPoint: [cEnd + 1, r],
        length: xAt(grid, cEnd + 1) - xAt(grid, c),
      });
      c = cEnd + 1;
    }
  }

  return runs;
}

/** What crosses a run perpendicularly at one of its *interior* grid
 *  points (c,r) — a boundary between two cells that got merged into the
 *  same run. 'through' means a perpendicular run passes fully across
 *  (both neighbors present, same height/group — by the same rule
 *  enumerateWallRuns itself uses to merge, so they're necessarily one
 *  continuous perpendicular piece): that's an X crossing, needing a
 *  half-lap notch on both pieces. 'stems' means one or two perpendicular
 *  pieces merely end here: a T junction, needing a mortise hole in this
 *  run for each stem's tenon (its ordinary end-comb, unchanged). */
export function crossingAt(grid, wallKind, pointC, pointR) {
  const cols = grid.sx.length;
  const rows = grid.sy.length;
  let a = null, b = null;
  if (wallKind === 'v') {
    a = pointC - 1 >= 0 ? grid.hWalls[pointC - 1][pointR] : null;
    b = pointC < cols ? grid.hWalls[pointC][pointR] : null;
  } else {
    a = pointR - 1 >= 0 ? grid.vWalls[pointC][pointR - 1] : null;
    b = pointR < rows ? grid.vWalls[pointC][pointR] : null;
  }
  const aPresent = !!a && a.present;
  const bPresent = !!b && b.present;
  if (aPresent && bPresent && a.heightMm === b.heightMm && a.thicknessGroup === b.thicknessGroup) {
    return { type: 'through', seg: a };
  }
  const stems = [];
  if (aPresent) stems.push(a);
  if (bPresent) stems.push(b);
  return { type: stems.length ? 'stems' : 'none', stems };
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
