// PiecePlacement3D places every piece of computePieces() into one shared
// 3D world space, ahead of the 3D preview's own extrusion step. Returns a
// full orthonormal basis (origin + 3 unit axes) rather than Euler angles,
// so this stays pure/testable arithmetic with zero dependency on any
// particular rendering library's own rotation-composition order (see the
// plan).
import { test, assert, assertClose, run } from './testHarness.js';
import { createGrid } from '../model/Grid.js';
import { createDefaultProject } from '../state/Project.js';
import { Box } from '../geometry/oo/Box.js';
import { computePiecePlacement3D, toWorld, translatePlacement, computeDrawerOffset } from '../geometry/PiecePlacement3D.js';

function computePieces(project) {
  return Box.fromProject(project).allPiecesBurnCorrected();
}

// Same fixture as gridQuery.test.js's xAt/yAt scenario: xAt(...,1) = 51
// (50 + half the 2mm divider).
function fixtureProject() {
  const project = createDefaultProject();
  project.grid = createGrid([50, 50], [50, 50]);
  project.outerThicknessMm = 3;
  project.innerThicknessMm = 2;
  return project;
}

function assertVec(actual, expected, msg) {
  assertClose(actual.x, expected.x, 1e-9, `${msg} (x)`);
  assertClose(actual.y, expected.y, 1e-9, `${msg} (y)`);
  assertClose(actual.z, expected.z, 1e-9, `${msg} (z)`);
}

test('the base plate placement is the identity transform at the world origin, extruding straight up', () => {
  const project = fixtureProject();
  const basePlate = computePieces(project).find((p) => p.id === 'base-plate');
  const placement = computePiecePlacement3D(project.grid, project, basePlate);
  assertVec(placement.origin, { x: 0, y: 0, z: 0 }, 'origin');
  assertVec(placement.uAxis, { x: 1, y: 0, z: 0 }, 'uAxis');
  assertVec(placement.vAxis, { x: 0, y: 1, z: 0 }, 'vAxis');
  assertVec(placement.wAxis, { x: 0, y: 0, z: 1 }, 'wAxis');
});

test('the outer top wall (r=0) extrudes entirely outward (-Y), its inner face flush with the compartment boundary Y=0', () => {
  const project = fixtureProject();
  const wall = computePieces(project).find((p) => p.id === 'wall-h-0-0');
  assert(wall, 'expected a merged top-wall run wall-h-0-0');
  const placement = computePiecePlacement3D(project.grid, project, wall);
  assertVec(placement.origin, { x: 0, y: 0, z: 3 }, 'origin: xAt(cStart)=0, yAt(0)=0, baseZ=outerThicknessMm');
  assertVec(placement.wAxis, { x: 0, y: -1, z: 0 }, 'extrudes outward, away from the interior');
});

test('the outer bottom wall (r=rows) extrudes entirely outward (+Y), its inner face flush with the far compartment boundary', () => {
  const project = fixtureProject();
  const wall = computePieces(project).find((p) => p.id === 'wall-h-0-2');
  assert(wall, 'expected a merged bottom-wall run wall-h-0-2');
  const placement = computePiecePlacement3D(project.grid, project, wall);
  assertVec(placement.origin, { x: 0, y: 102, z: 3 }, 'origin: yAt(rows)=102 for this fixture');
  assertVec(placement.wAxis, { x: 0, y: 1, z: 0 }, 'extrudes outward, away from the interior');
});

test('the outer left wall (c=0) extrudes entirely outward (-X)', () => {
  const project = fixtureProject();
  const wall = computePieces(project).find((p) => p.id === 'wall-v-0-0');
  assert(wall, 'expected a merged left-wall run wall-v-0-0');
  const placement = computePiecePlacement3D(project.grid, project, wall);
  assertVec(placement.origin, { x: 0, y: 0, z: 3 }, 'origin at the world X=0 boundary');
  assertVec(placement.wAxis, { x: -1, y: 0, z: 0 }, 'extrudes outward, away from the interior');
});

test('the outer right wall (c=cols) extrudes entirely outward (+X)', () => {
  const project = fixtureProject();
  const wall = computePieces(project).find((p) => p.id === 'wall-v-2-0');
  assert(wall, 'expected a merged right-wall run wall-v-2-0');
  const placement = computePiecePlacement3D(project.grid, project, wall);
  assertVec(placement.origin, { x: 102, y: 0, z: 3 }, 'origin: xAt(cols)=102 for this fixture');
  assertVec(placement.wAxis, { x: 1, y: 0, z: 0 }, 'extrudes outward, away from the interior');
});

test('an interior v-divider (c=1) centers its thickness on the grid line, unlike an outer wall', () => {
  const project = fixtureProject();
  const divider = computePieces(project).find((p) => p.id === 'wall-v-1-0');
  assert(divider, 'expected a merged interior divider run wall-v-1-0');
  const placement = computePiecePlacement3D(project.grid, project, divider);
  assertClose(placement.origin.x, 51 - 1, 1e-9, 'xAt(1)=51 minus half the 2mm inner thickness');
  assertVec(placement.wAxis, { x: 1, y: 0, z: 0 }, 'interior dividers extrude toward +X by convention');
});

test('an interior h-divider (r=1) centers its thickness on the grid line, unlike an outer wall', () => {
  const project = fixtureProject();
  const divider = computePieces(project).find((p) => p.id === 'wall-h-0-1');
  assert(divider, 'expected a merged interior divider run wall-h-0-1');
  const placement = computePiecePlacement3D(project.grid, project, divider);
  assertClose(placement.origin.y, 51 - 1, 1e-9, 'yAt(1)=51 minus half the 2mm inner thickness');
  assertVec(placement.wAxis, { x: 0, y: 1, z: 0 }, 'interior dividers extrude toward +Y by convention');
});

test('a recessed lid placement sits flat at outerThicknessMm + insertHeightMm above the base plate, same orientation as the base plate', () => {
  const project = fixtureProject();
  project.lid = { enabled: true, mode: 'recessed', insertHeightMm: 30 };
  const lid = computePieces(project).find((p) => p.id === 'lid');
  assert(lid, 'expected a lid piece once project.lid is enabled');
  const placement = computePiecePlacement3D(project.grid, project, lid);
  assertVec(placement.origin, { x: 0, y: 0, z: 3 + 30 }, 'origin.z = outerThicknessMm + insertHeightMm');
  assertVec(placement.wAxis, { x: 0, y: 0, z: 1 }, 'flat, same orientation as the base plate');
});

test('an onTop lid placement sits flat at outerThicknessMm + perimeterHeight (its insertHeightMm is always implicit, never read from project.lid)', () => {
  const project = fixtureProject(); // grid=[50,50]x[50,50], outerHeightMm defaults to 50 (createDefaultProject)
  project.lid = { enabled: true, mode: 'onTop', insertHeightMm: null };
  const lid = computePieces(project).find((p) => p.id === 'lid');
  assert(lid, 'expected a lid piece once project.lid is enabled');
  const placement = computePiecePlacement3D(project.grid, project, lid);
  assertVec(placement.origin, { x: 0, y: 0, z: 3 + 50 }, 'origin.z = outerThicknessMm + perimeterHeight, not any stored insertHeightMm');
  assertVec(placement.wAxis, { x: 0, y: 0, z: 1 }, 'flat, same orientation as the base plate');
});

test('translatePlacement shifts only origin, leaving the basis untouched', () => {
  const placement = {
    origin: { x: 1, y: 2, z: 3 },
    uAxis: { x: 1, y: 0, z: 0 },
    vAxis: { x: 0, y: 1, z: 0 },
    wAxis: { x: 0, y: 0, z: -1 },
  };
  const translated = translatePlacement(placement, { x: 10, y: -5, z: 0 });
  assertVec(translated.origin, { x: 11, y: -3, z: 3 }, 'origin');
  assertVec(translated.uAxis, placement.uAxis, 'uAxis unchanged');
  assertVec(translated.wAxis, placement.wAxis, 'wAxis unchanged');
});

test('a drawer base plate placement is the sleeve\'s own identity transform, translated by computeDrawerOffset', () => {
  const project = fixtureProject();
  project.drawer = { enabled: true, playMm: 1, thicknessMm: 3, openSide: 'right' };
  const drawerBasePlate = computePieces(project).find((p) => p.id === 'drawer:base-plate');
  assert(drawerBasePlate, 'expected a drawer:base-plate piece once the drawer is enabled');
  const placement = computePiecePlacement3D(project.grid, project, drawerBasePlate);
  assertVec(placement.origin, computeDrawerOffset(project), 'origin: identity (0,0,0) + computeDrawerOffset');
  assertVec(placement.wAxis, { x: 0, y: 0, z: 1 }, 'wAxis unchanged by the offset translation');
});

test('a drawer wall placement resolves against the SLEEVE\'s own grid/project (not the main box\'s), then is offset', () => {
  const project = fixtureProject(); // outerThicknessMm 3
  project.drawer = { enabled: true, playMm: 1, thicknessMm: 3, openSide: 'right' };
  // openSide 'right' removes the sleeve's v,c=1 wall — its remaining closed
  // left wall (v,c=0) is a plain outer wall of the sleeve's own 1x1 grid.
  const drawerLeftWall = computePieces(project).find((p) => p.id === 'drawer:wall-v-0-0');
  assert(drawerLeftWall, 'expected a drawer:wall-v-0-0 piece');
  const placement = computePiecePlacement3D(project.grid, project, drawerLeftWall);
  const offset = computeDrawerOffset(project);
  // Local placement (sleeve's own frame): origin (0,0,baseZ=drawer.thicknessMm=3), extrudes outward (-X) same as any c=0 outer wall.
  assertVec(placement.origin, { x: offset.x, y: offset.y, z: 3 + offset.z }, 'origin: sleeve-local origin + computeDrawerOffset');
  assertVec(placement.wAxis, { x: -1, y: 0, z: 0 }, 'extrudes outward, same convention as the main box\'s own c=0 wall');
});

test('a drawer lid rests exactly playMm above the main box\'s own top — the sleeve\'s own onTop lid, translated by computeDrawerOffset', () => {
  const project = fixtureProject(); // outerThicknessMm 3, outerHeightMm 50 (default) => main box top at world Z=53
  project.drawer = { enabled: true, playMm: 1, thicknessMm: 3, openSide: 'right' };
  const drawerLid = computePieces(project).find((p) => p.id === 'drawer:lid');
  assert(drawerLid, 'expected a drawer:lid piece — the sleeve always has an onTop lid');
  const placement = computePiecePlacement3D(project.grid, project, drawerLid);
  const offset = computeDrawerOffset(project);
  assertVec(placement.origin, { x: offset.x, y: offset.y, z: 54 }, 'sleeve-local origin (0,0) + computeDrawerOffset, z = main box top (53) + drawer.playMm (1)');
  assertVec(placement.wAxis, { x: 0, y: 0, z: 1 }, 'flat, same orientation as the base plate');
});

test('toWorld combines a placement and a local point via the basis + origin', () => {
  const placement = {
    origin: { x: 10, y: 20, z: 30 },
    uAxis: { x: 1, y: 0, z: 0 },
    vAxis: { x: 0, y: 0, z: 1 },
    wAxis: { x: 0, y: -1, z: 0 },
  };
  const world = toWorld(placement, { x: 5, y: 2, z: 1 });
  // 10 + 5*1, 20 + 1*(-1) + 2*0... local.y maps through vAxis, local.z through wAxis
  assertVec(world, { x: 15, y: 20 - 1, z: 30 + 2 }, 'origin + local.x*uAxis + local.y*vAxis + local.z*wAxis');
});

run();
