// Resolves a piece id (as produced by computePieces()) back to the
// grid/project/run context that built it — needed by the grip-notch UI,
// which only ever has a piece id string (from a click on the grid or the
// preview strip) but needs the real run to validate against and to render
// a live, real-pipeline preview. A Piece itself doesn't carry this back.
//
// Doubles as the "is this even a wall?" gate for free: enumerateWallRuns
// never produces a run for the base plate or lid ids, so this returns null
// for those without any separate kind check.
import { enumerateWallRuns } from '../model/GridQuery.js';
import { wallPieceId } from './PanelBuilder.js';
import { buildSleeveContext, DRAWER_PREFIX } from './DrawerBuilder.js';

export function resolveWallRunContext(project, pieceId) {
  const isDrawer = pieceId.startsWith(DRAWER_PREFIX);
  const rawId = isDrawer ? pieceId.slice(DRAWER_PREFIX.length) : pieceId;

  let grid, runProject;
  if (isDrawer) {
    const ctx = buildSleeveContext(project.grid, project);
    if (!ctx) return null;
    grid = ctx.sleeveGrid;
    runProject = ctx.sleeveProject;
  } else {
    grid = project.grid;
    runProject = project;
  }

  const run = enumerateWallRuns(grid, runProject).find((r) => wallPieceId(r) === rawId);
  return run ? { grid, project: runProject, run, rawId } : null;
}
