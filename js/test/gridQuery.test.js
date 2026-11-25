// Regression tests for perpendicularMatesAtPoint: this is the O(1) lookup
// that stands in for an explicit T/X junction classifier (see the plan) —
// its correctness at corners, T junctions, and X crossings is what keeps
// PanelBuilder's comb depths right without any float-position matching.
import { test, assert, assertClose, run } from './testHarness.js';
import { createGrid, setSegmentHeight, setSegmentPresent, toggleWall } from '../model/Grid.js';
import { perpendicularMatesAtPoint, enumerateWallRuns, crossingAt, junctionKindAt, runAt, xAt, yAt, outerBoxWidth, outerBoxDepth, outerBoxHeight, validateHorizontalPanelHeight, basePlateRecessMm, isBasePlateRecessValid, coverageRectangle, validateCoverage, horizontalPanelCoverage, interiorExtentAcross } from '../model/GridQuery.js';
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

test('outerBoxWidth/outerBoxDepth add a full outerThicknessMm margin on each side of the interior span', () => {
  const project = createDefaultProject();
  project.grid = createGrid([150], [100]);
  project.outerThicknessMm = 3;
  assertClose(outerBoxWidth(project.grid, project), 156, 1e-9, '150 interior + 3mm margin each side');
  assertClose(outerBoxDepth(project.grid, project), 106, 1e-9, '100 interior + 3mm margin each side');
});

test('outerBoxWidth/outerBoxDepth on the 2x2/50mm scenario match basePlateBuilder.test.js\'s own already-tested 108mm footprint', () => {
  const project = createDefaultProject();
  project.grid = createGrid([50, 50], [50, 50]);
  project.outerThicknessMm = 3;
  project.innerThicknessMm = 2;
  assertClose(outerBoxWidth(project.grid, project), 108, 1e-9);
  assertClose(outerBoxDepth(project.grid, project), 108, 1e-9);
});

test('outerBoxHeight is the base plate plus the perimeter wall height, with no lid contribution when the lid is disabled', () => {
  const project = createDefaultProject();
  project.grid = createGrid([100], [100]);
  project.outerThicknessMm = 3;
  project.outerHeightMm = 40;
  assertClose(outerBoxHeight(project.grid, project), 43, 1e-9, 'outerThicknessMm + perimeterHeight, lid disabled by default');
});

test('outerBoxHeight() should be unchanged by a horizontal panel, even at the top of its valid range', () => {
  const project = createDefaultProject();
  project.grid = createGrid([100], [100]);
  project.outerThicknessMm = 3;
  project.outerHeightMm = 40;
  project.horizontalPanels = [{ id: 'horizontal-panel-1', heightMm: 40 - 3, coverage: null }];
  assertClose(outerBoxHeight(project.grid, project), 43, 1e-9, 'same as the no-lid case: outerThicknessMm + perimeterHeight');
});

test('outerBoxHeight() should add one outer thickness for the lid, which rests on the walls like the base plate does below them', () => {
  const project = createDefaultProject();
  project.grid = createGrid([100], [100]);
  project.outerThicknessMm = 3;
  project.outerHeightMm = 40;
  project.lid = { enabled: true };
  assertClose(outerBoxHeight(project.grid, project), 46, 1e-9, 'outerThicknessMm (base) + perimeterHeight + outerThicknessMm (lid)');
});

test('outerBoxHeight() should add the base plate recess when the base plate is recessed', () => {
  const project = createDefaultProject();
  project.grid = createGrid([100], [100]);
  project.outerThicknessMm = 3;
  project.outerHeightMm = 40;
  project.basePlate = { mode: 'recessed', recessMm: 5 };
  assertClose(outerBoxHeight(project.grid, project), 48, 1e-9, 'recessMm + outerThicknessMm (base) + perimeterHeight');
});

test('basePlateRecessMm() should default to the outer thickness when a recessed base plate has no recess set', () => {
  const project = createDefaultProject();
  project.outerThicknessMm = 4;
  project.basePlate = { mode: 'recessed', recessMm: null };
  assertClose(basePlateRecessMm(project), 4, 1e-9);
});

test('outerBoxHeight() should add both the base plate recess and the lid', () => {
  const project = createDefaultProject();
  project.grid = createGrid([100], [100]);
  project.outerThicknessMm = 3;
  project.outerHeightMm = 40;
  project.basePlate = { mode: 'recessed', recessMm: 5 };
  project.lid = { enabled: true };
  assertClose(outerBoxHeight(project.grid, project), 51, 1e-9, 'recessMm + outerThicknessMm (base) + perimeterHeight + outerThicknessMm (lid)');
});

test('basePlateRecessMm() should ignore a stored recess while the base plate is flush', () => {
  const project = createDefaultProject();
  project.basePlate = { mode: 'flush', recessMm: 5 };
  assertClose(basePlateRecessMm(project), 0, 1e-9);
});

test('basePlateRecessMm() should be 0 for a project saved before the base plate setting existed', () => {
  const project = createDefaultProject();
  delete project.basePlate;
  assertClose(basePlateRecessMm(project), 0, 1e-9);
});

test('isBasePlateRecessValid() should reject a recess that leaves no wood below the mortise holes', () => {
  assert(isBasePlateRecessValid(0) === false, 'a zero recess turns every mortise hole into an open notch');
  assert(isBasePlateRecessValid(-1) === false, 'a negative recess is meaningless');
});

test('isBasePlateRecessValid() should accept any positive recess', () => {
  assert(isBasePlateRecessValid(0.5) === true);
});

test('validateHorizontalPanelHeight() should accept a panel whose top face is flush with the top of the walls', () => {
  const project = createDefaultProject();
  project.grid = createGrid([100], [100]);
  project.outerThicknessMm = 3;
  project.outerHeightMm = 40;
  const { ok, min, max } = validateHorizontalPanelHeight(project.grid, project, 37);
  assert(ok, 'heightMm=37 (perimeterHeight-outerThicknessMm) should be the top of the valid range');
  assertClose(min, 0, 1e-9);
  assertClose(max, 37, 1e-9);
});

test('validateHorizontalPanelHeight() should keep a panel one thickness below the top of the walls when the lid rests on them, so its mortises never undercut the lid fingers', () => {
  const project = createDefaultProject();
  project.grid = createGrid([100], [100]);
  project.outerThicknessMm = 3;
  project.outerHeightMm = 40;
  project.lid = { enabled: true };
  const { ok, max } = validateHorizontalPanelHeight(project.grid, project, 37);
  assert(!ok, 'expected a panel flush with the top of the walls to be rejected under a lid');
  assertClose(max, 40 - 3 - 3, 1e-9);
});

// junctionKindAt: the additive, endpoint-aware generalization of
// crossingAt — one vocabulary (crossing/stem/corner/none) for both a run's
// interior points and its own two endpoints. Reuses the exact same grid
// fixtures as the crossingAt/perpendicularMatesAtPoint tests above.

test('junctionKindAt at an interior point: an X crossing is "crossing", a T junction is "stem"', () => {
  const grid = createGrid([90, 130], [70, 100]);
  const crossing = junctionKindAt(grid, 'v', 1, 1, false);
  assert(crossing.kind === 'crossing', `expected 'crossing' at the X crossing, got '${crossing.kind}'`);

  const tGrid = createGrid([80, 80], [100]);
  const stem = junctionKindAt(tGrid, 'h', 1, 0, false);
  assert(stem.kind === 'stem', `expected 'stem' at a T junction, got '${stem.kind}'`);
  assert(stem.stems.length === 1);
});

test('junctionKindAt at a run\'s own endpoint: a box corner (two outer walls terminating together) is "corner"', () => {
  const grid = createGrid([150], [100]);
  // top-left corner: the left wall's ('v', c=0) own top end (its aPoint).
  const corner = junctionKindAt(grid, 'v', 0, 0, true);
  assert(corner.kind === 'corner', `expected 'corner' at a box corner, got '${corner.kind}'`);
});

test('junctionKindAt at a run\'s own endpoint: a divider ending into a continuing perpendicular wall\'s face is "stem" (inverted from crossingAt\'s own "through")', () => {
  const grid = createGrid([80, 80], [100]); // divider at c=1, T junction against the top/bottom edges
  // the divider's own aPoint (1,0): the top edge is ONE continuous run
  // there (crossingAt itself reports 'through'), but from the DIVIDER's
  // own end perspective, it's the divider that terminates — a stem, not
  // a corner — the whole reason 'through' and 'stem' swap meaning between
  // an interior point and an endpoint.
  const end = junctionKindAt(grid, 'v', 1, 0, true);
  assert(end.kind === 'stem', `expected 'stem' (the divider's own end butting into the continuous top edge), got '${end.kind}'`);
});

test('junctionKindAt: "none" when nothing is present in the perpendicular direction, at both an interior point and an endpoint', () => {
  let grid = createGrid([150], [50, 50]);
  grid = toggleWall(grid, 'h', 0, 1); // remove the interior horizontal divider
  const interior = junctionKindAt(grid, 'v', 0, 1, false);
  assert(interior.kind === 'none', `expected 'none' at an interior point with nothing perpendicular, got '${interior.kind}'`);

  let openGrid = createGrid([150], [100]);
  openGrid = setSegmentPresent(openGrid, 'h', 0, 0, false); // disable the whole top wall (an open side, like a drawer sleeve)
  const end = junctionKindAt(openGrid, 'v', 0, 0, true);
  assert(end.kind === 'none', `expected 'none' at an endpoint with nothing perpendicular (open side), got '${end.kind}'`);
});

function coverageFixtureProject() {
  const project = createDefaultProject();
  project.grid = createGrid([60], [30]);
  return project;
}

test('coverageRectangle() should span the whole interior when there is no coverage', () => {
  const project = coverageFixtureProject();
  const rect = coverageRectangle(project.grid, project, null);
  assert(JSON.stringify(rect) === JSON.stringify({ xMm: 0, yMm: 0, widthMm: 60, depthMm: 30 }), `got ${JSON.stringify(rect)}`);
});

test('coverageRectangle() should keep a top coverage against the top wall, full width', () => {
  const project = coverageFixtureProject();
  const rect = coverageRectangle(project.grid, project, { side: 'top', depthMm: 12 });
  assert(JSON.stringify(rect) === JSON.stringify({ xMm: 0, yMm: 0, widthMm: 60, depthMm: 12 }), `got ${JSON.stringify(rect)}`);
});

test('coverageRectangle() should push a bottom coverage against the bottom wall', () => {
  const project = coverageFixtureProject();
  const rect = coverageRectangle(project.grid, project, { side: 'bottom', depthMm: 12 });
  assert(JSON.stringify(rect) === JSON.stringify({ xMm: 0, yMm: 18, widthMm: 60, depthMm: 12 }), `got ${JSON.stringify(rect)}`);
});

test('coverageRectangle() should keep a left coverage against the left wall, full depth', () => {
  const project = coverageFixtureProject();
  const rect = coverageRectangle(project.grid, project, { side: 'left', depthMm: 12 });
  assert(JSON.stringify(rect) === JSON.stringify({ xMm: 0, yMm: 0, widthMm: 12, depthMm: 30 }), `got ${JSON.stringify(rect)}`);
});

test('coverageRectangle() should push a right coverage against the right wall', () => {
  const project = coverageFixtureProject();
  const rect = coverageRectangle(project.grid, project, { side: 'right', depthMm: 12 });
  assert(JSON.stringify(rect) === JSON.stringify({ xMm: 48, yMm: 0, widthMm: 12, depthMm: 30 }), `got ${JSON.stringify(rect)}`);
});

test('coverageRectangle() should throw on an unknown side instead of guessing one', () => {
  const project = coverageFixtureProject();
  let thrown = null;
  try { coverageRectangle(project.grid, project, { side: 'north', depthMm: 12 }); } catch (err) { thrown = err; }
  assert(thrown && /north/.test(thrown.message), `expected an error naming the unknown side, got ${thrown}`);
});

test('validateCoverage() should accept a top coverage shallower than the interior depth, reporting that depth as the maximum', () => {
  const project = coverageFixtureProject();
  const { ok, max } = validateCoverage(project.grid, project, { side: 'top', depthMm: 12 });
  assert(ok, 'expected a 12mm strip to fit in a 30mm-deep interior');
  assertClose(max, 30, 1e-9);
});

test('validateCoverage() should reject a coverage as deep as the interior, since it would no longer leave any opening', () => {
  const project = coverageFixtureProject();
  assert(!validateCoverage(project.grid, project, { side: 'bottom', depthMm: 30 }).ok, 'expected a 30mm strip in a 30mm-deep interior to be rejected');
});

test('validateCoverage() should measure a left or right coverage against the interior width', () => {
  const project = coverageFixtureProject();
  const { ok, max } = validateCoverage(project.grid, project, { side: 'right', depthMm: 40 });
  assert(ok, 'expected a 40mm strip to fit in a 60mm-wide interior');
  assertClose(max, 60, 1e-9);
});

test('validateCoverage() should reject a zero coverage depth', () => {
  const project = coverageFixtureProject();
  assert(!validateCoverage(project.grid, project, { side: 'top', depthMm: 0 }).ok, 'expected a 0mm strip to be rejected');
});

test('validateCoverage() should reject a missing coverage depth', () => {
  const project = coverageFixtureProject();
  assert(!validateCoverage(project.grid, project, { side: 'top', depthMm: null }).ok, 'expected a missing depth to be rejected');
});

test('horizontalPanelCoverage() should return the coverage of a partial panel', () => {
  const panel = { id: 'horizontal-panel-1', heightMm: 20, coverage: { side: 'top', depthMm: 12 } };
  assert(JSON.stringify(horizontalPanelCoverage(panel)) === JSON.stringify({ side: 'top', depthMm: 12 }), `got ${JSON.stringify(horizontalPanelCoverage(panel))}`);
});

test('horizontalPanelCoverage() should be null for a fully covering panel', () => {
  const panel = { id: 'horizontal-panel-1', heightMm: 20, coverage: null };
  assert(horizontalPanelCoverage(panel) === null, `got ${JSON.stringify(horizontalPanelCoverage(panel))}`);
});

test('horizontalPanelCoverage() should throw on a stored coverage with an unknown side instead of silently defaulting it', () => {
  const panel = { id: 'horizontal-panel-1', heightMm: 20, coverage: { side: 'north', depthMm: 12 } };
  let thrown = null;
  try { horizontalPanelCoverage(panel); } catch (err) { thrown = err; }
  assert(thrown && /north/.test(thrown.message), `expected an error naming the unknown side, got ${thrown}`);
});

test('horizontalPanelCoverage() should throw on a stored coverage whose depth is not a number', () => {
  const panel = { id: 'horizontal-panel-1', heightMm: 20, coverage: { side: 'top', depthMm: '20' } };
  let thrown = null;
  try { horizontalPanelCoverage(panel); } catch (err) { thrown = err; }
  assert(thrown && /depth/.test(thrown.message), `expected an error about the depth, got ${thrown}`);
});

test('interiorExtentAcross() should throw on an unknown side instead of treating it as left or right', () => {
  const project = coverageFixtureProject();
  let thrown = null;
  try { interiorExtentAcross(project.grid, project, 'north'); } catch (err) { thrown = err; }
  assert(thrown && /north/.test(thrown.message), `expected an error naming the unknown side, got ${thrown}`);
});

run();
