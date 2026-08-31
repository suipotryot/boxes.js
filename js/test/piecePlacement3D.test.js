// PiecePlacement3D places every piece of computePieces() into one shared
// 3D world space, ahead of the 3D preview's extrusion step. Returns a full
// orthonormal basis (origin + 3 unit axes) rather than Zdog-style Euler
// angles, so this stays pure/testable arithmetic with zero dependency on
// Zdog's own rotation-composition order (see the plan).
import { test, assert, assertClose, run } from './testHarness.js';
import { createGrid } from '../model/Grid.js';
import { createDefaultProject } from '../state/Project.js';
import { computePieces } from './../geometry/PieceFactory.js';
import { computePiecePlacement3D, toWorld } from '../geometry/PiecePlacement3D.js';

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

test('the lid placement sits flat at outerThicknessMm + insertHeightMm above the base plate, same orientation as the base plate', () => {
  const project = fixtureProject();
  project.lid = { enabled: true, insertHeightMm: 30 };
  const lid = computePieces(project).find((p) => p.id === 'lid');
  assert(lid, 'expected a lid piece once project.lid is enabled');
  const placement = computePiecePlacement3D(project.grid, project, lid);
  assertVec(placement.origin, { x: 0, y: 0, z: 3 + 30 }, 'origin.z = outerThicknessMm + insertHeightMm');
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
