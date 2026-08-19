// The single entry point of the geometry engine: (project) -> Piece[].
// Nothing downstream (editor rendering, export) is allowed to know about
// walls/fingers/junctions — everything consumes this flat, already
// burn-corrected list.
import { enumerateWallSegments } from '../model/GridQuery.js';
import { buildWallPanel } from './PanelBuilder.js';
import { buildBasePlate } from './BasePlateBuilder.js';
import { burnCorrect } from './BurnCorrection.js';

export function computePieces(project) {
  const { grid } = project;
  const hasBasePlate = true; // M1: always present; per-cell floors land in a later milestone
  const wallSegs = enumerateWallSegments(grid);

  const pieces = [];
  for (const wallSeg of wallSegs) pieces.push(buildWallPanel(wallSeg, grid, project, hasBasePlate));
  if (hasBasePlate) pieces.push(buildBasePlate(grid, project));

  return pieces.map((p) => burnCorrect(p, project.burnMm));
}
