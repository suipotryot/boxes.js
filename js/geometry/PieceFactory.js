// The single entry point of the geometry engine: (project) -> Piece[].
// Nothing downstream (editor rendering, export) is allowed to know about
// walls/fingers/junctions — everything consumes this flat, already
// burn-corrected list.
import { enumerateWallRuns } from '../model/GridQuery.js';
import { buildWallPanel } from './PanelBuilder.js';
import { buildBasePlate } from './BasePlateBuilder.js';
import { buildLid } from './LidBuilder.js';
import { buildDrawerBox } from './DrawerBuilder.js';
import { burnCorrect } from './BurnCorrection.js';

export function computePieces(project) {
  const { grid } = project;
  const hasBasePlate = true; // M1: always present; per-cell floors land in a later milestone
  const wallRuns = enumerateWallRuns(grid, project);

  const pieces = [];
  for (const run of wallRuns) pieces.push(buildWallPanel(run, grid, project, hasBasePlate));
  if (hasBasePlate) pieces.push(buildBasePlate(grid, project));
  const lid = buildLid(grid, project);
  if (lid) pieces.push(lid);
  const drawerPieces = buildDrawerBox(grid, project);
  if (drawerPieces) pieces.push(...drawerPieces);

  return pieces.map((p) => burnCorrect(p, project.burnMm));
}
