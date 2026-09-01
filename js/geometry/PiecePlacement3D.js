// Places every piece of computePieces() into one shared 3D world space,
// ahead of the 3D preview's own extrusion step (ThreeJsScene.js, via
// three.js's ExtrudeGeometry). X = width, Y = depth, Z = height, Z=0 at
// the true floor (the base plate's own bottom face) — baseZ =
// outerThicknessMm is the world Z of GridQuery's own v=0 convention (a
// wall's bottom mating edge / the base plate's top face).
//
// Returns a full orthonormal basis (origin + 3 unit axes) instead of
// Euler rotate angles: this keeps 100% of the placement arithmetic
// pure/testable, with zero dependency on any particular rendering
// library's own rotation-composition order — getting that order wrong
// would silently mis-rotate a whole wall, hard to catch from a
// screenshot. It also paid off directly when the renderer itself got
// swapped (Zdog -> three.js, see the plan): this module needed no change
// at all, since a basis maps onto a three.js Matrix4 (via makeBasis) just
// as directly as it mapped onto raw Zdog world-space points.
//
// Mirrors the exact outward-vs-centered asymmetry xAt/yAt and
// BasePlateBuilder's own margin logic already encode: an outer
// (perimeter) wall extrudes its thickness entirely OUTWARD from the
// compartment boundary; an interior divider extrudes CENTERED on the grid
// line (half each side) — see isOuterSegment.
import { enumerateWallRuns, xAt, yAt } from '../model/GridQuery.js';
import { isOuterSegment } from '../model/Grid.js';
import { wallPieceId } from './PanelBuilder.js';
import { buildSleeveContext, computeDrawerOffset, DRAWER_PREFIX } from './DrawerBuilder.js';

function identityPlacement() {
  return {
    origin: { x: 0, y: 0, z: 0 },
    uAxis: { x: 1, y: 0, z: 0 },
    vAxis: { x: 0, y: 1, z: 0 },
    wAxis: { x: 0, y: 0, z: 1 },
  };
}

/** Places a piece using whichever grid/project actually built it — the
 *  main box's own for an ordinary piece, or (see computePiecePlacement3D
 *  below) the drawer sleeve's own synthetic grid/project for a drawer
 *  piece, with `pieceId` already stripped of DRAWER_PREFIX either way. Runs
 *  are looked up directly via enumerateWallRuns/wallPieceId rather than
 *  PieceContext.resolveWallRunContext, which re-derives its OWN grid/
 *  project from a (possibly still-prefixed) id — calling it here, on an
 *  already-resolved sleeve grid/project, would try to resolve the prefix a
 *  second time. */
function computeLocalPlacement(grid, project, pieceId, piece) {
  const baseZ = project.outerThicknessMm;

  if (piece.kind === 'basePlate') return identityPlacement();
  if (piece.kind === 'lid') {
    const placement = identityPlacement();
    placement.origin.z = baseZ + project.lid.insertHeightMm;
    return placement;
  }
  if (piece.kind !== 'wall') {
    throw new Error(`computePiecePlacement3D: unsupported piece kind "${piece.kind}"`);
  }

  const run = enumerateWallRuns(grid, project).find((r) => wallPieceId(r) === pieceId);
  const thickness = piece.thicknessMm;

  if (run.kind === 'h') {
    const outer = isOuterSegment(grid, 'h', run.aPoint[0], run.aPoint[1]);
    const x0 = xAt(grid, project, run.cStart);
    const y0 = yAt(grid, project, run.r) - (outer ? 0 : thickness / 2);
    const wAxis = outer && run.r === 0 ? { x: 0, y: -1, z: 0 } : { x: 0, y: 1, z: 0 };
    return { origin: { x: x0, y: y0, z: baseZ }, uAxis: { x: 1, y: 0, z: 0 }, vAxis: { x: 0, y: 0, z: 1 }, wAxis };
  }

  // run.kind === 'v'
  const outer = isOuterSegment(grid, 'v', run.aPoint[0], run.aPoint[1]);
  const y0 = yAt(grid, project, run.rStart);
  const x0 = xAt(grid, project, run.c) - (outer ? 0 : thickness / 2);
  const wAxis = outer && run.c === 0 ? { x: -1, y: 0, z: 0 } : { x: 1, y: 0, z: 0 };
  return { origin: { x: x0, y: y0, z: baseZ }, uAxis: { x: 0, y: 1, z: 0 }, vAxis: { x: 0, y: 0, z: 1 }, wAxis };
}

/**
 * @param {object} grid
 * @param {object} project
 * @param {object} piece one entry from computePieces(project) — kind must
 *   be 'basePlate', 'lid', or 'wall'. A drawer-prefixed id (see
 *   DrawerBuilder.DRAWER_PREFIX) is placed against the sleeve's own
 *   synthetic grid/project (buildSleeveContext), then translated into the
 *   main box's world space by computeDrawerOffset.
 * @returns {{origin:{x,y,z}, uAxis:{x,y,z}, vAxis:{x,y,z}, wAxis:{x,y,z}}}
 *   world = origin + local.x*uAxis + local.y*vAxis + local.z*wAxis, where
 *   (local.x, local.y) is a point from piece.outline (or piece.holes) and
 *   local.z in [0, piece.thicknessMm] is the extrusion depth.
 */
export function computePiecePlacement3D(grid, project, piece) {
  if (!piece.id.startsWith(DRAWER_PREFIX)) {
    return computeLocalPlacement(grid, project, piece.id, piece);
  }

  const { sleeveGrid, sleeveProject } = buildSleeveContext(grid, project);
  const rawId = piece.id.slice(DRAWER_PREFIX.length);
  const local = computeLocalPlacement(sleeveGrid, sleeveProject, rawId, piece);
  return translatePlacement(local, computeDrawerOffset(project));
}

/** Shifts only `origin`, leaving the basis (uAxis/vAxis/wAxis) untouched —
 *  used above to place a drawer piece into the main box's world space, and
 *  reused by ThreeJsScene.js to apply the "open the drawer" slider's
 *  translation on top of a piece's own placement. */
export function translatePlacement(placement, offset) {
  return {
    ...placement,
    origin: {
      x: placement.origin.x + offset.x,
      y: placement.origin.y + offset.y,
      z: placement.origin.z + offset.z,
    },
  };
}

/** world = placement.origin + local.x*uAxis + local.y*vAxis + local.z*wAxis */
export function toWorld(placement, local) {
  const { origin, uAxis, vAxis, wAxis } = placement;
  return {
    x: origin.x + local.x * uAxis.x + local.y * vAxis.x + local.z * wAxis.x,
    y: origin.y + local.x * uAxis.y + local.y * vAxis.y + local.z * wAxis.y,
    z: origin.z + local.x * uAxis.z + local.y * vAxis.z + local.z * wAxis.z,
  };
}
