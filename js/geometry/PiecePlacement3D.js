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
import { xAt, yAt } from '../model/GridQuery.js';
import { isOuterSegment } from '../model/Grid.js';
import { resolveWallRunContext } from './PieceContext.js';

function identityPlacement() {
  return {
    origin: { x: 0, y: 0, z: 0 },
    uAxis: { x: 1, y: 0, z: 0 },
    vAxis: { x: 0, y: 1, z: 0 },
    wAxis: { x: 0, y: 0, z: 1 },
  };
}

/**
 * @param {object} grid
 * @param {object} project
 * @param {object} piece one entry from computePieces(project) — kind must
 *   be 'basePlate', 'lid', or 'wall' (with a non-drawer-prefixed id; the
 *   drawer sleeve is out of scope for the 3D view, see the plan).
 * @returns {{origin:{x,y,z}, uAxis:{x,y,z}, vAxis:{x,y,z}, wAxis:{x,y,z}}}
 *   world = origin + local.x*uAxis + local.y*vAxis + local.z*wAxis, where
 *   (local.x, local.y) is a point from piece.outline (or piece.holes) and
 *   local.z in [0, piece.thicknessMm] is the extrusion depth.
 */
export function computePiecePlacement3D(grid, project, piece) {
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

  const { run } = resolveWallRunContext(project, piece.id);
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

/** world = placement.origin + local.x*uAxis + local.y*vAxis + local.z*wAxis */
export function toWorld(placement, local) {
  const { origin, uAxis, vAxis, wAxis } = placement;
  return {
    x: origin.x + local.x * uAxis.x + local.y * vAxis.x + local.z * wAxis.x,
    y: origin.y + local.x * uAxis.y + local.y * vAxis.y + local.z * wAxis.y,
    z: origin.z + local.x * uAxis.z + local.y * vAxis.z + local.z * wAxis.z,
  };
}
