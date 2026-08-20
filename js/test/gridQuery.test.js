// Regression tests for perpendicularMatesAtPoint: this is the O(1) lookup
// that stands in for an explicit T/X junction classifier (see the plan) —
// its correctness at corners, T junctions, and X crossings is what keeps
// PanelBuilder's comb depths right without any float-position matching.
import { test, assert, assertClose, run } from './testHarness.js';
import { createGrid, setSegmentHeight, toggleWall } from '../model/Grid.js';
import { perpendicularMatesAtPoint, enumerateWallRuns, crossingAt, runAt, xAt, yAt } from '../model/GridQuery.js';
import { createDefaultProject } from '../state/Project.js';

test('a box corner has exactly one perpendicular mate', () => {
  const grid = createGrid([150], [100]);
  // top-left corner (0,0): the left wall's top end mates with the top wall.
  const mates = perpendicularMatesAtPoint(grid, 'v', 0, 0);
  assert(mates.length === 1, `expected 1 mate at a corner, got ${mates.length}`);
});

test('a T junction: the stem sees both collinear through-wall halves', () => {
  // 2 cols x 1 row: a single interior vertical divider at c=1 meets the
  // top/bottom outer edges, each split into two collinear halves by it.
  const grid = createGrid([80, 80], [100]);
  const stemMates = perpendicularMatesAtPoint(grid, 'v', 1, 0);
  assert(stemMates.length === 2, `expected 2 mates at the T junction's stem end, got ${stemMates.length}`);
  assert(stemMates.every((m) => m.thicknessGroup === 'outer'), 'T-junction mates should be the outer top edge halves');
});

test('a T junction: each through-wall half sees only the stem', () => {
  const grid = createGrid([80, 80], [100]);
  // hWalls[0][0] is the left half of the top edge; its right end (1,0) is
  // the T junction, where it should see only the divider, not itself.
  const throughMates = perpendicularMatesAtPoint(grid, 'h', 1, 0);
  assert(throughMates.length === 1, `expected 1 mate seen by a through-wall half, got ${throughMates.length}`);
  assert(throughMates[0].thicknessGroup === 'inner', 'the through-wall half should see the inner divider as its mate');
});

test('an X crossing: all four converging wall ends see exactly two mates', () => {
  const grid = createGrid([90, 130], [70, 100]);
  // center point (1,1) is where both interior dividers cross.
  const vMates = perpendicularMatesAtPoint(grid, 'v', 1, 1);
  const hMates = perpendicularMatesAtPoint(grid, 'h', 1, 1);
  assert(vMates.length === 2, `expected 2 mates for the vertical divider at the X crossing, got ${vMates.length}`);
  assert(hMates.length === 2, `expected 2 mates for the horizontal divider at the X crossing, got ${hMates.length}`);
  assert([...vMates, ...hMates].every((m) => m.thicknessGroup === 'inner'), 'all mates at an interior X crossing should be inner-group');
});

test('enumerateWallRuns merges a plain 2x2 grid into 4 outer sides + 2 dividers, never one run per grid cell', () => {
  const project = createDefaultProject();
  const grid = createGrid([90, 130], [70, 100]);
  const runs = enumerateWallRuns(grid, project);
  assert(runs.length === 6, `expected 6 runs (4 sides + 2 dividers), got ${runs.length}`);
  const outerRuns = runs.filter((r) => r.seg.thicknessGroup === 'outer');
  const innerRuns = runs.filter((r) => r.seg.thicknessGroup === 'inner');
  assert(outerRuns.length === 4, `expected 4 outer runs, got ${outerRuns.length}`);
  assert(innerRuns.length === 2, `expected 2 interior divider runs, got ${innerRuns.length}`);
});

test('enumerateWallRuns does NOT split a run when only the height varies along it', () => {
  // A height difference is not a physical gap — the piece is still cut
  // from one sheet, just with a stepped top profile (PanelBuilder).
  const project = createDefaultProject();
  let grid = createGrid([80, 80], [50, 50]); // 2 cols x 2 rows, divider at c=1 is 2 cells
  grid = setSegmentHeight(grid, 'v', 1, 1, 30); // customize only the bottom cell's height
  const runs = enumerateWallRuns(grid, project);
  const dividerRuns = runs.filter((r) => r.kind === 'v' && r.c === 1);
  assert(dividerRuns.length === 1, `a height-only difference should stay one run, got ${dividerRuns.length} run(s)`);
});

test('enumerateWallRuns DOES split a run where a segment is removed (a real gap)', () => {
  const project = createDefaultProject();
  let grid = createGrid([80, 80], [50, 50]);
  grid = toggleWall(grid, 'v', 1, 1); // remove the bottom cell of the divider
  const runs = enumerateWallRuns(grid, project);
  const dividerRuns = runs.filter((r) => r.kind === 'v' && r.c === 1);
  assert(dividerRuns.length === 1, `expected exactly 1 remaining run (the top cell only), got ${dividerRuns.length}`);
  assert(dividerRuns[0].rStart === 0 && dividerRuns[0].rEnd === 0, 'the remaining run should be just the top cell');
});

test('crossingAt classifies an X crossing as "through" and a T junction as "stems"', () => {
  const grid = createGrid([90, 130], [70, 100]);
  const through = crossingAt(grid, 'v', 1, 1); // the X crossing
  assert(through.type === 'through', `expected 'through' at the X crossing, got '${through.type}'`);

  const tGrid = createGrid([80, 80], [100]); // T-junction-only grid
  const stems = crossingAt(tGrid, 'h', 1, 0); // top edge, where the divider lands mid-span
  assert(stems.type === 'stems', `expected 'stems' at a T junction, got '${stems.type}'`);
  assert(stems.stems.length === 1, `expected exactly 1 stem, got ${stems.stems.length}`);
});

test('runAt resolves any cell of a merged run to the SAME run — used to map an editor selection to its physical piece', () => {
  const project = createDefaultProject();
  const grid = createGrid([90, 130], [70, 100]); // 2x2: the top edge is one merged run across both columns
  const viaFirstCell = runAt(grid, project, 'h', 0, 0);
  const viaSecondCell = runAt(grid, project, 'h', 1, 0);
  assert(viaFirstCell && viaSecondCell, 'both cells should resolve to a run');
  assert(viaFirstCell === viaSecondCell || (viaFirstCell.aPoint[0] === viaSecondCell.aPoint[0] && viaFirstCell.aPoint[1] === viaSecondCell.aPoint[1]), 'both cells of the same merged run should resolve to the identical run');
  assert(viaFirstCell.cStart === 0 && viaFirstCell.cEnd === 1, 'the resolved run should span both columns, not just the selected cell');
});

test('runAt returns null for an absent (removed) segment — nothing to highlight there', () => {
  const project = createDefaultProject();
  let grid = createGrid([80, 80], [100]);
  grid = toggleWall(grid, 'v', 1, 0); // remove the interior divider
  assert(runAt(grid, project, 'v', 1, 0) === null);
});

// xAt/yAt: sx/sy are clear INTERIOR spans (boxes.py-style), not raw
// centerline-to-centerline distances. Interior grid lines split their own
// thickness half-and-half between the two compartments they separate;
// outer perimeter grid lines contribute nothing at all (the outer wall's
// material extends entirely outward from there, never eating into the
// interior span) — confirmed directly with the user against this exact
// scenario: a 2x2 grid of 50mm cells, 3mm outer walls, 2mm interior
// divider should measure exactly 102mm end to end (50 + 2 + 50), not
// 100mm (today's bug, ignoring wall thickness) and not 105mm (the
// alternative of treating outer walls the same centered way as interior
// ones — explicitly rejected by the user).
test('xAt/yAt add half the interior divider thickness at the shared boundary, nothing at the outer perimeter', () => {
  const project = createDefaultProject();
  project.grid = createGrid([50, 50], [50, 50]);
  project.outerThicknessMm = 3;
  project.innerThicknessMm = 2;
  assertClose(xAt(project.grid, project, 0), 0, 1e-9, 'left outer wall contributes nothing');
  assertClose(xAt(project.grid, project, 1), 51, 1e-9, '50 + half the 2mm divider');
  assertClose(xAt(project.grid, project, 2), 102, 1e-9, '51 + half the divider + the second 50mm compartment');
  assertClose(yAt(project.grid, project, 0), 0, 1e-9);
  assertClose(yAt(project.grid, project, 1), 51, 1e-9);
  assertClose(yAt(project.grid, project, 2), 102, 1e-9);
});

test('a fully-absent interior column contributes zero — no phantom gap for a divider that does not exist', () => {
  const project = createDefaultProject();
  project.grid = createGrid([50, 50], [100]);
  project.grid = toggleWall(project.grid, 'v', 1, 0); // remove the only interior divider
  assertClose(xAt(project.grid, project, 1), 50, 1e-9, 'no divider present, no contribution at this boundary yet');
  assertClose(xAt(project.grid, project, 2), 100, 1e-9, 'the two compartments merge with no added gap');
});

run();
