// Box/Assembly: the full orchestration (walls + base plate + burn
// correction), verified end-to-end against PieceFactory.computePieces'
// own (still-live, unchanged) output — the strongest check available,
// exercising every lower-level piece (Edge/Panel/HalfLapNotch/MortiseHole/
// BasePlate) together rather than in isolation.
//
// Now covers the fixed lid (flush and recessed) and grip notches too — see
// FingerEdge's forceEndsToFinger, Assembly's lidState/buildLid, and
// Assembly's gripFragments wiring (Notch.toEdgeFragment). Deliberately
// still scoped WITHOUT the drawer — its own real increment.
import { test, assert, run } from './testHarness.js';
import { createGrid, setSegmentHeight } from '../model/Grid.js';
import { createDefaultProject, createM2ExampleProject } from '../state/Project.js';
import { computePieces } from '../geometry/PieceFactory.js';
import { Box } from '../geometry/oo/Box.js';

function sortedRounded(pts) {
  return pts.map((p) => `${p.x.toFixed(6)},${p.y.toFixed(6)}`).sort();
}

function assertSamePieceSet(old, mine) {
  assert(old.length === mine.length, `expected ${old.length} pieces, got ${mine.length}`);
  const oldById = Object.fromEntries(old.map((p) => [p.id, p]));
  const mineById = Object.fromEntries(mine.map((p) => [p.id, p]));
  for (const id of Object.keys(oldById)) {
    assert(mineById[id], `missing piece "${id}" in the new pipeline's output`);
    const a = oldById[id], b = mineById[id];
    assert(
      JSON.stringify(sortedRounded(a.outline)) === JSON.stringify(sortedRounded(b.outline)),
      `outline mismatch for "${id}"`,
    );
    const aHoles = a.holes.map(sortedRounded).sort();
    const bHoles = b.holes.map(sortedRounded).sort();
    assert(JSON.stringify(aHoles) === JSON.stringify(bHoles), `holes mismatch for "${id}"`);
  }
}

test('matches computePieces exactly for a single cell (simplest possible box)', () => {
  const project = createDefaultProject();
  project.grid = createGrid([100], [80]);
  project.outerThicknessMm = 3;
  project.outerHeightMm = 40;

  const old = computePieces(project);
  const mine = Box.fromProject(project).allPiecesBurnCorrected();
  assertSamePieceSet(old, mine);
});

test('matches computePieces exactly for a 2x2 grid (X crossing + T junctions + mixed thickness/height)', () => {
  const project = createDefaultProject();
  project.grid = createGrid([90, 130], [70, 100]);
  project.outerThicknessMm = 3;
  project.innerThicknessMm = 2;
  project.outerHeightMm = 40;
  project.innerHeightMm = 35;

  const old = computePieces(project);
  const mine = Box.fromProject(project).allPiecesBurnCorrected();
  assertSamePieceSet(old, mine);
});

test('matches computePieces exactly for the project\'s own canonical M2 example (T/X junctions)', () => {
  const project = createM2ExampleProject();
  const old = computePieces(project);
  const mine = Box.fromProject(project).allPiecesBurnCorrected();
  assertSamePieceSet(old, mine);
});

test('matches computePieces exactly with a height step on part of a divider (stresses SmoothEdge stepping inside the full pipeline)', () => {
  const project = createDefaultProject();
  let grid = createGrid([80, 80], [50, 50]);
  grid = setSegmentHeight(grid, 'v', 1, 1, 30);
  project.grid = grid;
  project.outerThicknessMm = 3;
  project.innerThicknessMm = 2;
  project.outerHeightMm = 40;
  project.innerHeightMm = 35;

  const old = computePieces(project);
  const mine = Box.fromProject(project).allPiecesBurnCorrected();
  assertSamePieceSet(old, mine);
});

test('matches computePieces exactly for a single cell with a FLUSH lid', () => {
  const project = createDefaultProject();
  project.grid = createGrid([100], [80]);
  project.outerThicknessMm = 3;
  project.outerHeightMm = 40;
  project.lid = { enabled: true, insertHeightMm: 40 - 3 };

  const old = computePieces(project);
  const mine = Box.fromProject(project).allPiecesBurnCorrected();
  assertSamePieceSet(old, mine);
});

test('matches computePieces exactly for a single cell with a RECESSED lid', () => {
  const project = createDefaultProject();
  project.grid = createGrid([100], [80]);
  project.outerThicknessMm = 3;
  project.outerHeightMm = 40;
  project.lid = { enabled: true, insertHeightMm: 20 };

  const old = computePieces(project);
  const mine = Box.fromProject(project).allPiecesBurnCorrected();
  assertSamePieceSet(old, mine);
});

test('matches computePieces exactly for a 2x2 grid (X + T junctions) with a FLUSH lid — the exact scenario the original 2026-09-03 corner-joint bug involved', () => {
  const project = createDefaultProject();
  project.grid = createGrid([90, 130], [70, 100]);
  project.outerThicknessMm = 3;
  project.innerThicknessMm = 2;
  project.outerHeightMm = 40;
  project.innerHeightMm = 35;
  project.lid = { enabled: true, insertHeightMm: 40 - 3 };

  const old = computePieces(project);
  const mine = Box.fromProject(project).allPiecesBurnCorrected();
  assertSamePieceSet(old, mine);
});

test('matches computePieces exactly for a 2x2 grid with a RECESSED lid', () => {
  const project = createDefaultProject();
  project.grid = createGrid([90, 130], [70, 100]);
  project.outerThicknessMm = 3;
  project.innerThicknessMm = 2;
  project.outerHeightMm = 40;
  project.innerHeightMm = 35;
  project.lid = { enabled: true, insertHeightMm: 20 };

  const old = computePieces(project);
  const mine = Box.fromProject(project).allPiecesBurnCorrected();
  assertSamePieceSet(old, mine);
});

test('matches computePieces exactly with a square grip notch on an outer wall, no lid', () => {
  const project = createDefaultProject();
  project.grid = createGrid([150], [100]);
  project.outerThicknessMm = 3;
  project.outerHeightMm = 50;
  project.pieceNotches = { 'wall-h-0-0': [{ widthMm: 30, depthMm: 10, offsetMm: 20, radiusMm: 0 }] };

  const old = computePieces(project);
  const mine = Box.fromProject(project).allPiecesBurnCorrected();
  assertSamePieceSet(old, mine);
});

test('matches computePieces exactly with a ROUNDED grip notch AND a flush lid together — the exact interaction Assembly wires (gripFragments feeding into the forceEndsToFinger edge)', () => {
  const project = createDefaultProject();
  project.grid = createGrid([150], [100]);
  project.outerThicknessMm = 3;
  project.outerHeightMm = 50;
  project.lid = { enabled: true, insertHeightMm: 50 - 3 };
  project.pieceNotches = { 'wall-h-0-0': [{ widthMm: 30, depthMm: 10, offsetMm: 20, radiusMm: 5 }] };

  const old = computePieces(project);
  const mine = Box.fromProject(project).allPiecesBurnCorrected();
  assertSamePieceSet(old, mine);
});

test('matches computePieces exactly with a grip notch on an interior Divider (2x2 grid)', () => {
  const project = createDefaultProject();
  project.grid = createGrid([90, 130], [70, 100]);
  project.outerThicknessMm = 3;
  project.innerThicknessMm = 2;
  project.outerHeightMm = 40;
  project.innerHeightMm = 35;
  project.pieceNotches = { 'wall-v-1-0': [{ widthMm: 20, depthMm: 8, offsetMm: 15, radiusMm: 3 }] };

  const old = computePieces(project);
  const mine = Box.fromProject(project).allPiecesBurnCorrected();
  assertSamePieceSet(old, mine);
});

test('matches computePieces exactly with two disjoint grip notches on the same wall', () => {
  const project = createDefaultProject();
  project.grid = createGrid([150], [100]);
  project.outerThicknessMm = 3;
  project.outerHeightMm = 50;
  project.pieceNotches = {
    'wall-h-0-0': [
      { widthMm: 20, depthMm: 8, offsetMm: 10, radiusMm: 0 },
      { widthMm: 20, depthMm: 10, offsetMm: 100, radiusMm: 10 },
    ],
  };

  const old = computePieces(project);
  const mine = Box.fromProject(project).allPiecesBurnCorrected();
  assertSamePieceSet(old, mine);
});

run();
