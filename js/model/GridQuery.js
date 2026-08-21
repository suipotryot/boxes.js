// Pure, read-only queries over a Grid. No geometry here — everything is an
// array lookup, which is the entire point of the fixed-lattice model.

export function resolveThickness(segment, project) {
  return segment.thicknessGroup === 'outer' ? project.outerThicknessMm : project.innerThicknessMm;
}

export function resolveHeight(segment, project) {
  if (segment.heightMm != null) return segment.heightMm;
  return segment.thicknessGroup === 'outer' ? project.outerHeightMm : project.innerHeightMm;
}

// The thickness shared by every present segment in vertical column `c`
// (thicknessGroup can no longer be reassigned per segment — see Grid.js's
// removed setSegmentThicknessGroup — so every present segment in a given
// column is guaranteed to share the same thickness; reading the first one
// is enough, no need to scan for a max). 0 if the column has no present
// segment at all (a fully-removed interior divider contributes nothing).
function columnThickness(grid, project, c) {
  for (const seg of grid.vWalls[c]) if (seg.present) return resolveThickness(seg, project);
  return 0;
}

function rowThickness(grid, project, r) {
  for (const col of grid.hWalls) if (col[r].present) return resolveThickness(col[r], project);
  return 0;
}

/** x-coordinate of vertical grid line `c` — NOT a raw sum of `grid.sx`.
 *  `sx[i]` is the CLEAR INTERIOR width of compartment i (boxes.py's own
 *  TrayLayout convention, which this app's plan always intended to
 *  replicate but never actually implemented this way until now): each
 *  INTERIOR grid line contributes half its own wall's thickness to each
 *  of the two compartments it separates (centered on the line, symmetric
 *  — unchanged, already-correct convention). Each OUTER perimeter grid
 *  line (c=0, c=cols) contributes NOTHING — the outer wall's own material
 *  extends entirely OUTWARD from there, never eating into the interior
 *  span; confirmed directly with the user against a concrete worked
 *  example (2x2 grid of 50mm cells, 3mm outer walls, 2mm divider measures
 *  exactly 102mm end to end, not 100mm and not 105mm). */
export function xAt(grid, project, c) {
  const cols = grid.sx.length;
  let x = 0;
  for (let i = 0; i < c; i++) {
    if (i > 0) x += columnThickness(grid, project, i) / 2;
    x += grid.sx[i];
    if (i + 1 < cols) x += columnThickness(grid, project, i + 1) / 2;
  }
  return x;
}

export function yAt(grid, project, r) {
  const rows = grid.sy.length;
  let y = 0;
  for (let i = 0; i < r; i++) {
    if (i > 0) y += rowThickness(grid, project, i) / 2;
    y += grid.sy[i];
    if (i + 1 < rows) y += rowThickness(grid, project, i + 1) / 2;
  }
  return y;
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

/** Maximal runs of contiguous present segments sharing the same
 *  thicknessGroup along one grid line — this is what actually gets cut as
 *  one physical piece. thicknessGroup must match to merge (one piece is
 *  cut from one sheet of one thickness — that's a physical constraint,
 *  not a preference), but heightMm does *not* have to match: a run of
 *  segments with different per-segment heights still merges into a
 *  single piece with a stepped top profile (PanelBuilder builds that
 *  profile from each covered cell's own resolved height). Removing a
 *  segment (present:false) is the only thing that actually breaks a run
 *  in two — a genuine physical gap, unlike a height difference. The
 *  outer perimeter is always exactly one run per side by construction —
 *  outer segments can never be removed and are always 'outer' group. */
export function enumerateWallRuns(grid, project) {
  const cols = grid.sx.length;
  const rows = grid.sy.length;
  const runs = [];
  const sameGroup = (a, b) => a.thicknessGroup === b.thicknessGroup;

  for (let c = 0; c <= cols; c++) {
    let r = 0;
    while (r < rows) {
      const seg = grid.vWalls[c][r];
      if (!seg.present) { r++; continue; }
      let rEnd = r;
      while (rEnd + 1 < rows && grid.vWalls[c][rEnd + 1].present && sameGroup(grid.vWalls[c][rEnd + 1], seg)) rEnd++;
      runs.push({
        kind: 'v', c, rStart: r, rEnd, seg,
        aPoint: [c, r], bPoint: [c, rEnd + 1],
        length: yAt(grid, project, rEnd + 1) - yAt(grid, project, r),
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
      while (cEnd + 1 < cols && grid.hWalls[cEnd + 1][r].present && sameGroup(grid.hWalls[cEnd + 1][r], seg)) cEnd++;
      runs.push({
        kind: 'h', r, cStart: c, cEnd, seg,
        aPoint: [c, r], bPoint: [cEnd + 1, r],
        length: xAt(grid, project, cEnd + 1) - xAt(grid, project, c),
      });
      c = cEnd + 1;
    }
  }

  return runs;
}

/** The run a given grid CELL (kind,c,r) belongs to, or null if that cell
 *  is absent (not part of any run — enumerateWallRuns only ever covers
 *  present segments). Used to map a single-cell editor selection to the
 *  merged physical piece it's actually part of (a run can span several
 *  cells) — e.g. so the UI can highlight the right preview piece for
 *  whatever grid line is currently selected. */
export function runAt(grid, project, kind, c, r) {
  for (const run of enumerateWallRuns(grid, project)) {
    if (run.kind !== kind) continue;
    if (kind === 'v' ? run.c === c && r >= run.rStart && r <= run.rEnd : run.r === r && c >= run.cStart && c <= run.cEnd) return run;
  }
  return null;
}

/** What crosses a run perpendicularly at one of its *interior* grid
 *  points (c,r) — a boundary between two cells that got merged into the
 *  same run. 'through' means a perpendicular run passes fully across
 *  (both neighbors present, same thicknessGroup — by the same rule
 *  enumerateWallRuns itself uses to merge, so they're necessarily one
 *  continuous perpendicular piece, even if their heights happen to
 *  differ): that's an X crossing, needing a half-lap notch on both
 *  pieces. `segs` carries *both* of the perpendicular run's cells
 *  touching this point (not just one) — they can have different heights
 *  (a height step can land exactly on a crossing point), and a caller
 *  computing "how tall is the other piece here" needs to consider both,
 *  not arbitrarily just one side. `seg` (either one — thickness is
 *  guaranteed equal, that's the merge condition) stays for callers that
 *  only need thickness. 'stems' means one or two perpendicular pieces
 *  merely end here: a T junction, needing a mortise hole in this run for
 *  each stem's tenon (its ordinary end-comb, unchanged). */
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
  if (aPresent && bPresent && a.thicknessGroup === b.thicknessGroup) {
    return { type: 'through', seg: a, segs: [a, b] };
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

// insertHeightMm is where the lid RESTS — its own bottom face, in the same
// v-coordinate space as perimeterHeight (v=0 at the base plate's top face).
// The lid's top face sits exactly one lid-thickness above that; a flush lid
// (see LidBuilder) is the case where that top face lands exactly on the
// perimeter's own top edge.
export function lidTopFace(insertHeightMm, project) {
  return insertHeightMm + project.outerThicknessMm;
}

export function isLidFlush(grid, project, insertHeightMm) {
  return Math.abs(lidTopFace(insertHeightMm, project) - perimeterHeight(grid, project)) < 1e-6;
}

/** Pure validation for a fixed lid's insertion height (the height its own
 *  BOTTOM face rests at): it must clear every interior divider directly —
 *  the lid only joints with the OUTER walls, and a stem taller than the
 *  lid's underside would collide with it instead of clearing it, see
 *  LidBuilder — and its top face (one lid-thickness above insertHeightMm,
 *  see lidTopFace) can never exceed the perimeter's own height, since the
 *  lid can't float above the walls that carry it. Returns the valid range
 *  alongside `ok` so a caller can render both the warning and a
 *  ready-to-use "clamp to range" suggestion without recomputing it. */
export function validateLid(grid, project, insertHeightMm) {
  const min = tallestInnerHeight(grid, project);
  const max = perimeterHeight(grid, project) - project.outerThicknessMm;
  const ok = insertHeightMm != null && insertHeightMm >= min && insertHeightMm <= max;
  return { ok, min, max };
}
