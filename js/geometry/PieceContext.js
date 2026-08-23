// Resolves a piece id (as produced by computePieces()) back to the
// grid/project context that built it — needed by the grip-notch and hole
// UI, which only ever have a piece id string (from a click on the grid or
// the preview strip) but need the real run/dimensions to validate against
// and to render a live, real-pipeline preview. A Piece itself doesn't
// carry this back.
//
// Doubles as the "is this even a wall?" gate for free: enumerateWallRuns
// never produces a run for the base plate or lid ids, so this returns null
// for those without any separate kind check.
import { enumerateWallRuns, xAt, yAt } from '../model/GridQuery.js';
import { wallPieceId } from './PanelBuilder.js';
import { buildSleeveContext, DRAWER_PREFIX } from './DrawerBuilder.js';

// Shared by resolveWallRunContext and resolvePieceHoleContext below: both
// need the same "which grid/project does this id's own DRAWER_PREFIX (if
// any) point at" resolution, just to build a different-shaped context
// afterward.
function resolveGridContext(project, pieceId) {
  const isDrawer = pieceId.startsWith(DRAWER_PREFIX);
  const rawId = isDrawer ? pieceId.slice(DRAWER_PREFIX.length) : pieceId;

  if (!isDrawer) return { rawId, grid: project.grid, runProject: project };
  const ctx = buildSleeveContext(project.grid, project);
  return ctx ? { rawId, grid: ctx.sleeveGrid, runProject: ctx.sleeveProject } : null;
}

export function resolveWallRunContext(project, pieceId) {
  const gridCtx = resolveGridContext(project, pieceId);
  if (!gridCtx) return null;
  const { rawId, grid, runProject } = gridCtx;

  const run = enumerateWallRuns(grid, runProject).find((r) => wallPieceId(r) === rawId);
  return run ? { grid, project: runProject, run, rawId } : null;
}

const FLAT_PIECE_IDS = new Set(['base-plate', 'lid']);

/** Like resolveWallRunContext, but also resolves the base plate/lid (and
 *  their drawer equivalents) — needed for the hole editor (Hole.js/
 *  HoleEditor.js), which applies to any flat piece, not just walls. A
 *  wall resolves to `{kind:'wall', run, grid, project, rawId}` (the same
 *  shape resolveWallRunContext returns, tagged); base-plate/lid resolve to
 *  `{kind:'flat', grid, project, rawId, widthMm, heightMm}` — the plate's
 *  own nominal W×D rectangle (BasePlateBuilder.buildOuterEdgeOutline's own
 *  xAt/yAt(...,cols/rows), the same rectangle a user hole must stay
 *  MIN_EDGE_MARGIN_MM inside of). */
export function resolvePieceHoleContext(project, pieceId) {
  const gridCtx = resolveGridContext(project, pieceId);
  if (!gridCtx) return null;
  const { rawId, grid, runProject } = gridCtx;

  if (FLAT_PIECE_IDS.has(rawId)) {
    const widthMm = xAt(grid, runProject, grid.sx.length);
    const heightMm = yAt(grid, runProject, grid.sy.length);
    return { kind: 'flat', grid, project: runProject, rawId, widthMm, heightMm };
  }

  const run = enumerateWallRuns(grid, runProject).find((r) => wallPieceId(r) === rawId);
  return run ? { kind: 'wall', grid, project: runProject, run, rawId } : null;
}
