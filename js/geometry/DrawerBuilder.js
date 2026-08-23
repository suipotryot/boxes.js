// The "boîte en tiroir" (drawer) feature: an enclosing sleeve box built
// around the current box's own outer footprint, with one side left open so
// the current box can slide in/out of it like a drawer. Built as an
// entirely independent single-cell Grid (its own tiny box, own thickness)
// rather than any modification to the current box's own grid/pieces — the
// two boxes never joint against each other, only clear each other by
// `playMm`.
//
// The sleeve is always base + lid + 3 of its own 4 walls (never 4 walls
// with no lid) — all four `openSide` choices (top/bottom/right/left) name a
// wall in the SAME horizontal plane; the base and lid are never the open
// side. This is what makes it a genuine drawer (slides out horizontally)
// rather than a lid-less sleeve (lifted out vertically), and it's why the
// piece count is always exactly 5 regardless of which side is open.
//
// Reuses the exact same builders the main box's own pieces go through
// (buildWallPanel/buildBasePlate/buildLid) against this synthetic grid —
// no new corner-joint or finger-tiling logic. What already made this work
// with zero further changes: GridQuery.enumerateWallRuns skips absent
// segments (no run → no wall piece on the open side),
// GridQuery.perpendicularMatesAtPoint filters on `.present` (an open
// side's neighboring walls see 0 mates at that corner), and
// PanelBuilder.endEdgePoints already has a `mateProtrusion <= 0` branch
// that degrades to a plain straight, comb-free edge there — exactly a
// flush corner with nothing to joint against. The one genuinely new piece
// (BasePlateBuilder.buildOuterEdgeOutline's per-side corner margin, see
// that file) is what makes the base plate/lid's own edge land flush with
// the open side too, instead of overhanging by the sleeve's own wall
// thickness with nothing there to justify it.
import { createGrid, setSegmentPresent } from '../model/Grid.js';
import { enumerateWallRuns, xAt, yAt, perimeterHeight } from '../model/GridQuery.js';
import { buildWallPanel } from './PanelBuilder.js';
import { buildBasePlate } from './BasePlateBuilder.js';
import { buildLid } from './LidBuilder.js';

// (kind, c, r) of the outer segment to remove for each side of a 1x1 grid,
// plus which axis ('x' = width/sx, 'y' = depth/sy) that side sits on. The
// open axis gets clearance (`playMm`) only at its closed end — the open
// end is flush with whatever sits just inside it, no clearance added
// there since there's no wall to clear. The other (fully closed) axis
// gets clearance at both ends, same as the height axis (base/lid, never
// the open side).
const OPEN_SIDE = {
  top: { kind: 'h', c: 0, r: 0, axis: 'y' },
  bottom: { kind: 'h', c: 0, r: 1, axis: 'y' },
  right: { kind: 'v', c: 1, r: 0, axis: 'x' },
  left: { kind: 'v', c: 0, r: 0, axis: 'x' },
};

export function buildDrawerBox(grid, project) {
  const { drawer } = project;
  if (!drawer || !drawer.enabled) return null;

  const innerW = xAt(grid, project, grid.sx.length) + 2 * project.outerThicknessMm;
  const innerD = yAt(grid, project, grid.sy.length) + 2 * project.outerThicknessMm;
  const innerH = perimeterHeight(grid, project);

  const { kind, c, r, axis } = OPEN_SIDE[drawer.openSide];
  const sleeveW = innerW + (axis === 'x' ? 1 : 2) * drawer.playMm;
  const sleeveD = innerD + (axis === 'y' ? 1 : 2) * drawer.playMm;
  const sleeveH = innerH + 2 * drawer.playMm; // base & lid always present, never the open side

  const sleeveGrid = setSegmentPresent(createGrid([sleeveW], [sleeveD]), kind, c, r, false);

  const sleeveProject = {
    ...project,
    outerThicknessMm: drawer.thicknessMm,
    outerHeightMm: sleeveH,
    lid: { enabled: true, insertHeightMm: sleeveH - drawer.thicknessMm }, // always flush
  };

  const pieces = enumerateWallRuns(sleeveGrid, sleeveProject)
    .map((run) => buildWallPanel(run, sleeveGrid, sleeveProject, true));
  pieces.push(buildBasePlate(sleeveGrid, sleeveProject));
  pieces.push(buildLid(sleeveGrid, sleeveProject));

  // ':' rather than '-' as the prefix separator: SvgPath.pieceLabel parses
  // a wall piece's id with a positional `id.split('-')` (matching
  // PanelBuilder.wallPieceId's own `wall-${kind}-${c}-${r}` format) — an
  // extra '-'-delimited token in front of that would shift every index
  // and corrupt the label (confirmed live: "Paroi WALLv,0" instead of
  // "Paroi V0,0"). ':' keeps the id unique across the two boxes' pieces
  // without perturbing that split.
  return pieces.map((p) => ({ ...p, id: `drawer:${p.id}` }));
}
