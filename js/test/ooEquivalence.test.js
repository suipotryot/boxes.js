// The dedicated equivalence-sweep step from the plan: a broader,
// combinatorial pass across grid topology × thickness × lid × drawer,
// beyond the one-off scenarios already covered piece-by-piece in the
// other oo*.test.js files (each of which targets ONE specific mechanism).
// This is the strongest safety net available before the pipeline cutover
// — in the spirit of feedback_geometry_verification_depth (compare
// coordinates exhaustively, not just one scenario per fix).
import { test, assert, run } from './testHarness.js';
import { createGrid, setSegmentHeight } from '../model/Grid.js';
import { createDefaultProject, createM1ExampleProject, createM2ExampleProject } from '../state/Project.js';
import { computePieces } from '../geometry/PieceFactory.js';
import { Box } from '../geometry/oo/Box.js';

function sortedRounded(pts) {
  return pts.map((p) => `${p.x.toFixed(6)},${p.y.toFixed(6)}`).sort();
}

function assertSamePieceSet(old, mine, label) {
  assert(old.length === mine.length, `[${label}] expected ${old.length} pieces, got ${mine.length}`);
  const oldById = Object.fromEntries(old.map((p) => [p.id, p]));
  const mineById = Object.fromEntries(mine.map((p) => [p.id, p]));
  for (const id of Object.keys(oldById)) {
    assert(mineById[id], `[${label}] missing piece "${id}"`);
    const a = oldById[id], b = mineById[id];
    assert(
      JSON.stringify(sortedRounded(a.outline)) === JSON.stringify(sortedRounded(b.outline)),
      `[${label}] outline mismatch for "${id}"`,
    );
    const aHoles = a.holes.map(sortedRounded).sort();
    const bHoles = b.holes.map(sortedRounded).sort();
    assert(JSON.stringify(aHoles) === JSON.stringify(bHoles), `[${label}] holes mismatch for "${id}"`);
  }
}

function assertEquivalent(project, label) {
  const old = computePieces(project);
  const mine = Box.fromProject(project).allPiecesBurnCorrected();
  assertSamePieceSet(old, mine, label);
}

// A range of grid topologies: 1x1, 2x1 and 1x2 (T junctions on each
// axis), 2x2 (X + T), 3x2 (multiple X crossings).
const TOPOLOGIES = [
  { label: '1x1', sx: [100], sy: [80] },
  { label: '2x1', sx: [80, 80], sy: [100] },
  { label: '1x2', sx: [100], sy: [80, 80] },
  { label: '2x2', sx: [90, 130], sy: [70, 100] },
  { label: '3x2', sx: [60, 60, 60], sy: [50, 50] },
];

const THICKNESS_CONFIGS = [
  { label: 'uniform 3/3', outerThicknessMm: 3, innerThicknessMm: 3 },
  { label: 'mixed 3/2', outerThicknessMm: 3, innerThicknessMm: 2 },
  { label: 'mixed 5/2', outerThicknessMm: 5, innerThicknessMm: 2 },
];

function baseProject(topology, thickness) {
  const project = createDefaultProject();
  project.grid = createGrid(topology.sx, topology.sy);
  project.outerThicknessMm = thickness.outerThicknessMm;
  project.innerThicknessMm = thickness.innerThicknessMm;
  project.outerHeightMm = 40;
  project.innerHeightMm = 32;
  return project;
}

test('sweep: every topology x thickness combination, no lid, no drawer', () => {
  for (const topology of TOPOLOGIES) {
    for (const thickness of THICKNESS_CONFIGS) {
      assertEquivalent(baseProject(topology, thickness), `${topology.label}, ${thickness.label}`);
    }
  }
});

test('sweep: every topology x thickness combination, WITH a flush lid', () => {
  for (const topology of TOPOLOGIES) {
    for (const thickness of THICKNESS_CONFIGS) {
      const project = baseProject(topology, thickness);
      project.lid = { enabled: true, insertHeightMm: project.outerHeightMm - project.outerThicknessMm };
      assertEquivalent(project, `${topology.label}, ${thickness.label}, flush lid`);
    }
  }
});

test('sweep: every topology x thickness combination, WITH a recessed lid', () => {
  for (const topology of TOPOLOGIES) {
    for (const thickness of THICKNESS_CONFIGS) {
      const project = baseProject(topology, thickness);
      project.lid = { enabled: true, insertHeightMm: project.innerHeightMm }; // below perimeter height = recessed
      assertEquivalent(project, `${topology.label}, ${thickness.label}, recessed lid`);
    }
  }
});

test('sweep: a drawer on each of the 4 possible open sides', () => {
  for (const openSide of ['top', 'bottom', 'left', 'right']) {
    const project = baseProject(TOPOLOGIES[0], THICKNESS_CONFIGS[0]);
    project.drawer = { enabled: true, playMm: 1, thicknessMm: 3, openSide };
    assertEquivalent(project, `drawer open=${openSide}`);
  }
});

test('sweep: a drawer on a non-trivial (2x2) box topology, each open side', () => {
  for (const openSide of ['top', 'bottom', 'left', 'right']) {
    const project = baseProject(TOPOLOGIES[3], THICKNESS_CONFIGS[1]);
    project.drawer = { enabled: true, playMm: 1.5, thicknessMm: 4, openSide };
    assertEquivalent(project, `2x2, drawer open=${openSide}`);
  }
});

test('matches computePieces exactly for the project\'s own canonical M1 example', () => {
  assertEquivalent(createM1ExampleProject(), 'M1 example');
});

test('matches computePieces exactly for the project\'s own canonical M2 example, re-checked here alongside the sweep', () => {
  assertEquivalent(createM2ExampleProject(), 'M2 example');
});

test('sweep: multiple independent height overrides across different segments in the same grid', () => {
  let grid = createGrid([60, 60, 60], [50, 50]);
  grid = setSegmentHeight(grid, 'v', 1, 0, 25);
  grid = setSegmentHeight(grid, 'v', 2, 1, 20);
  grid = setSegmentHeight(grid, 'h', 1, 1, 28);
  const project = createDefaultProject();
  project.grid = grid;
  project.outerThicknessMm = 3;
  project.innerThicknessMm = 2;
  project.outerHeightMm = 40;
  project.innerHeightMm = 32;
  assertEquivalent(project, 'multiple height overrides, 3x2 grid');
});

test('sweep: a larger 3x3 grid (several X crossings and T junctions together)', () => {
  const project = createDefaultProject();
  project.grid = createGrid([60, 60, 60], [50, 50, 50]);
  project.outerThicknessMm = 3;
  project.innerThicknessMm = 2;
  project.outerHeightMm = 40;
  project.innerHeightMm = 32;
  assertEquivalent(project, '3x3 grid');

  project.lid = { enabled: true, insertHeightMm: project.outerHeightMm - project.outerThicknessMm };
  assertEquivalent(project, '3x3 grid, flush lid');
});

run();
