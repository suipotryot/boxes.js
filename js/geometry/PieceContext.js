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
import { enumerateWallRuns, xAt, yAt, wallPieceId } from '../model/GridQuery.js';
import { isOuterSegment } from '../model/Grid.js';
import { Drawer, DRAWER_PREFIX } from './oo/Drawer.js';

// Shared by resolveWallRunContext and resolvePieceHoleContext below: both
// need the same "which grid/project does this id's own DRAWER_PREFIX (if
// any) point at" resolution, just to build a different-shaped context
// afterward. Drawer.sleeveContext itself doesn't check drawer.enabled (its
// only real caller, Box.build(), already gates on that before ever
// constructing a Drawer) — so this checks it explicitly, to still resolve
// to null gracefully for a stale drawer-prefixed id after the drawer gets
// disabled, exactly like the rest of this function already did.
function resolveGridContext(project, pieceId) {
  const isDrawer = pieceId.startsWith(DRAWER_PREFIX);
  const rawId = isDrawer ? pieceId.slice(DRAWER_PREFIX.length) : pieceId;

  if (!isDrawer) return { rawId, grid: project.grid, runProject: project };
  if (!project.drawer || !project.drawer.enabled) return null;
  const { grid, project: sleeveProject } = Drawer.sleeveContext({ grid: project.grid, project });
  return { rawId, grid, runProject: sleeveProject };
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

const COMPASS_SIDES = ['top', 'right', 'bottom', 'left'];

/** Which compass sides of a flat piece (base-plate/lid) have no outer wall
 *  run there — the only sides a grip notch can be added to (see
 *  Assembly.buildBoundarySides' own openSide branch: every OTHER side is a
 *  fully-toothed FingerEdge, with no smooth splice point for a notch).
 *  Empty for a wall piece id, and empty for the ordinary case (every outer
 *  wall present) — only a Drawer's own openSide (or any future case that
 *  leaves an outer side absent) ever produces entries here. `capMm` is the
 *  side's own perpendicular extent — the material budget a notch on that
 *  side cuts into (see NotchValidation.validateFlatEdgeNotch), the same
 *  quantity used to build that side's own SmoothEdge in Assembly.js. */
export function enumerateSmoothFlatEdges(grid, project, rawId) {
  if (!FLAT_PIECE_IDS.has(rawId)) return [];

  const cols = grid.sx.length, rows = grid.sy.length;
  const widthMm = xAt(grid, project, cols);
  const depthMm = yAt(grid, project, rows);
  const outerRuns = enumerateWallRuns(grid, project).filter((run) => isOuterSegment(grid, run.kind, run.aPoint[0], run.aPoint[1]));
  const hasRun = {
    top: outerRuns.some((r) => r.kind === 'h' && r.r === 0),
    right: outerRuns.some((r) => r.kind === 'v' && r.c === cols),
    bottom: outerRuns.some((r) => r.kind === 'h' && r.r === rows),
    left: outerRuns.some((r) => r.kind === 'v' && r.c === 0),
  };
  const lengthMmFor = { top: widthMm, bottom: widthMm, left: depthMm, right: depthMm };
  const capMmFor = { top: depthMm, bottom: depthMm, left: widthMm, right: widthMm };
  // Same axis/boundary split as Assembly.wallSmoothEdges' own `frame` (see
  // NotchFrame.js): top/left cut inward from a 0 boundary, bottom/right cut
  // inward from their own capMm — matching FlatPanel.js's own
  // nominalPointAt/inwardDirection for each compass exactly.
  const frameFor = {
    top: { axis: 'x', zeroBoundary: true, boundaryAt: () => 0 },
    bottom: { axis: 'x', zeroBoundary: false, boundaryAt: () => capMmFor.bottom },
    left: { axis: 'y', zeroBoundary: true, boundaryAt: () => 0 },
    right: { axis: 'y', zeroBoundary: false, boundaryAt: () => capMmFor.right },
  };

  return COMPASS_SIDES
    .filter((compass) => !hasRun[compass])
    .map((compass) => ({ compass, lengthMm: lengthMmFor[compass], capMm: capMmFor[compass], frame: frameFor[compass] }));
}
