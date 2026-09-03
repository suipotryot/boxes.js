// Box/Assembly: the full orchestration (walls + base plate + burn
// correction), verified end-to-end against PieceFactory.computePieces'
// own (still-live, unchanged) output — the strongest check available,
// exercising every lower-level piece (Edge/Panel/HalfLapNotch/MortiseHole/
// BasePlate) together rather than in isolation.
//
// Deliberately scoped WITHOUT lid, grip notches, or the drawer yet — each
// is its own real increment (lid-wall interaction in particular is a
// materially different mechanism, see PanelBuilder.lidTopEdgePoints/
// lidHoles) — so every scenario below has no lid/notches/drawer enabled,
// matching what Assembly.build() actually supports today.
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

run();
