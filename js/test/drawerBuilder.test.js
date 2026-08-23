// "Boîte en tiroir": an independent enclosing sleeve box (own grid, own
// thickness) built around the current box's own outer footprint, open on
// one side — see DrawerBuilder.js's own header comment for the design.
// Always 5 pieces (base + lid + 3 walls), and — since the sleeve has no
// interior dividers at all — never any holes anywhere, on any piece.
import { test, assert, assertClose, run } from './testHarness.js';
import { createGrid } from '../model/Grid.js';
import { createDefaultProject } from '../state/Project.js';
import { buildDrawerBox, buildSleeveContext } from '../geometry/DrawerBuilder.js';
import { buildBasePlate, buildOuterEdgeOutline } from '../geometry/BasePlateBuilder.js';
import { computePieces } from '../geometry/PieceFactory.js';
import { pieceBounds, pieceLabel } from '../geometry/SvgPath.js';

function segmentsIntersect(p1, p2, p3, p4) {
  const cross = (a, b) => a.x * b.y - a.y * b.x;
  const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
  const d1 = cross(sub(p4, p3), sub(p1, p3));
  const d2 = cross(sub(p4, p3), sub(p2, p3));
  const d3 = cross(sub(p2, p1), sub(p3, p1));
  const d4 = cross(sub(p2, p1), sub(p4, p1));
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}
function isSimplePolygon(points) {
  const n = points.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const shareVertex = j === i || (j + 1) % n === i || j === (i + 1) % n;
      if (shareVertex) continue;
      if (segmentsIntersect(points[i], points[(i + 1) % n], points[j], points[(j + 1) % n])) return false;
    }
  }
  return true;
}

function baseProject() {
  const project = createDefaultProject();
  project.grid = createGrid([100], [100]); // single cell, no interior dividers
  project.outerThicknessMm = 3;
  project.outerHeightMm = 50;
  return project;
}

test('buildDrawerBox returns null when disabled, computePieces unaffected', () => {
  const project = baseProject();
  assert(buildDrawerBox(project.grid, project) === null);
  const before = computePieces(project).length;
  project.drawer = { ...project.drawer, enabled: false };
  assert(computePieces(project).length === before);
  assert(!computePieces(project).some((p) => p.id.startsWith('drawer:')));
});

for (const openSide of ['top', 'bottom', 'right', 'left']) {
  test(`buildDrawerBox(openSide:'${openSide}'): always 5 pieces, simple outlines, no holes anywhere`, () => {
    const project = baseProject();
    project.drawer = { enabled: true, playMm: 1, thicknessMm: 3, openSide };
    const pieces = buildDrawerBox(project.grid, project);
    assert(pieces.length === 5, `expected 5 pieces (base + lid + 3 walls), got ${pieces.length}`);
    assert(pieces.filter((p) => p.kind === 'wall').length === 3, 'expected exactly 3 wall pieces (the open side has none)');
    assert(pieces.filter((p) => p.kind === 'basePlate').length === 1);
    assert(pieces.filter((p) => p.kind === 'lid').length === 1, 'the lid must always be present, regardless of which side is open');
    for (const piece of pieces) {
      assert(piece.id.startsWith('drawer:'), `piece id ${piece.id} should be prefixed to avoid colliding with the main box's own pieces`);
      assert(isSimplePolygon(piece.outline), `${piece.id} outline self-intersects`);
      assert(piece.holes.length === 0, `${piece.id} should have no holes — the sleeve has no interior dividers to joint against`);
    }
  });
}

test('"à fleur": the open side (right) has no clearance and no corner margin — flush with the current box, not the sleeve wall thickness further out', () => {
  const project = baseProject();
  const playMm = 1;
  const drawerThicknessMm = 3;
  project.drawer = { enabled: true, playMm, thicknessMm: drawerThicknessMm, openSide: 'right' };

  const innerW = 100 + 2 * project.outerThicknessMm; // xAt(grid,...,1) + 2*outerThicknessMm
  const expectedFlushX = innerW + playMm; // NOT + drawerThicknessMm — that would be the old (wrong) blanket-margin behavior

  const pieces = buildDrawerBox(project.grid, project);
  const plate = pieces.find((p) => p.kind === 'basePlate');
  const lid = pieces.find((p) => p.kind === 'lid');

  for (const piece of [plate, lid]) {
    const xs = piece.outline.map((p) => p.x);
    assertClose(Math.max(...xs), expectedFlushX, 1e-9, `${piece.id}'s open (right) edge should sit exactly at innerW+playMm, not overhang by the sleeve's own wall thickness`);
    // The flush edge is a straight vertical line: exactly two points at that x.
    const atFlushX = piece.outline.filter((p) => Math.abs(p.x - expectedFlushX) < 1e-9);
    assert(atFlushX.length === 2, `${piece.id} should have exactly 2 points on the flush edge (a plain straight line), got ${atFlushX.length}`);
  }
});

test('"à fleur" also holds on the other axis (openSide: top) — flush at y=0, the near/origin end', () => {
  const project = baseProject();
  project.drawer = { enabled: true, playMm: 1, thicknessMm: 3, openSide: 'top' };
  const pieces = buildDrawerBox(project.grid, project);
  const plate = pieces.find((p) => p.kind === 'basePlate');

  const ys = plate.outline.map((p) => p.y);
  assertClose(Math.min(...ys), 0, 1e-9, 'the open (top) edge is at the near/origin end (r=0) — should sit exactly at y=0, no negative overhang');
  const atFlushY = plate.outline.filter((p) => Math.abs(p.y) < 1e-9);
  assert(atFlushY.length === 2, 'the flush edge should be a plain straight line (exactly 2 points)');
});

test('the closed/perpendicular axis still gets full clearance (2×playMm) and the normal wall-thickness corner margin', () => {
  const project = baseProject();
  const playMm = 1;
  const drawerThicknessMm = 3;
  project.drawer = { enabled: true, playMm, thicknessMm: drawerThicknessMm, openSide: 'right' };
  const innerD = 100 + 2 * project.outerThicknessMm;
  const expectedD = innerD + 2 * playMm;

  const pieces = buildDrawerBox(project.grid, project);
  const plate = pieces.find((p) => p.kind === 'basePlate');
  const ys = plate.outline.map((p) => p.y);
  // Both top and bottom walls are present on this axis, so the plate
  // extends drawerThicknessMm past [0, expectedD] at both ends, same as
  // any ordinary fully-enclosed box corner.
  assertClose(Math.min(...ys), -drawerThicknessMm, 1e-9);
  assertClose(Math.max(...ys), expectedD + drawerThicknessMm, 1e-9);
});

test('sleeve height clears the main box\'s REAL outer height (base plate + walls), not just wall height', () => {
  const project = baseProject(); // outerThicknessMm 3, outerHeightMm 50, lid disabled
  const playMm = 1;
  project.drawer = { enabled: true, playMm, thicknessMm: 3, openSide: 'right' };
  const { sleeveProject } = buildSleeveContext(project.grid, project);
  // true height = base plate (3) + walls (50), no lid contribution (disabled)
  assertClose(sleeveProject.outerHeightMm, (3 + 50) + 2 * playMm, 1e-9, 'sleeve interior height must clear base + walls, not walls alone');
});

test('sleeve height also clears a flush lid\'s own thickness (but not a recessed one, which adds no extra height)', () => {
  const project = baseProject();
  const playMm = 1;
  project.drawer = { enabled: true, playMm, thicknessMm: 3, openSide: 'right' };

  project.lid = { enabled: true, insertHeightMm: 47 }; // flush: lidTopFace (insertHeightMm + outerThicknessMm) === perimeterHeight
  const flush = buildSleeveContext(project.grid, project);
  assertClose(flush.sleeveProject.outerHeightMm, (3 + 50 + 3) + 2 * playMm, 1e-9, 'a flush lid adds its own thickness on top of the walls');

  project.lid = { enabled: true, insertHeightMm: 40 }; // recessed: walls extend above the lid as a rim
  const recessed = buildSleeveContext(project.grid, project);
  assertClose(recessed.sleeveProject.outerHeightMm, (3 + 50) + 2 * playMm, 1e-9, 'a recessed lid sits below the walls\' own top edge, so it adds nothing beyond perimeterHeight');
});

test('enabling the drawer does not change any of the main box\'s own pieces', () => {
  const project = baseProject();
  const before = computePieces(project).filter((p) => !p.id.startsWith('drawer:'));

  project.drawer = { enabled: true, playMm: 1, thicknessMm: 3, openSide: 'right' };
  const afterPieces = computePieces(project);
  const after = afterPieces.filter((p) => !p.id.startsWith('drawer:'));

  assert(before.length === after.length, 'main box piece count should be unaffected');
  for (let i = 0; i < before.length; i++) {
    assert(before[i].id === after[i].id, 'piece ids should be unaffected');
    assertClose(JSON.stringify(before[i].outline).length, JSON.stringify(after[i].outline).length, 0, 'outline point count should be unaffected');
  }
  assert(afterPieces.some((p) => p.id.startsWith('drawer:')), 'drawer pieces should be additionally present');
});

test('regression: the main box (all 4 sides always present) is byte-for-byte unaffected by the per-side corner-margin fix', () => {
  const project = baseProject();
  const outline = buildOuterEdgeOutline(project.grid, project);
  const margin = project.outerThicknessMm;
  // For the main box every side is always present, so every corner still
  // gets the full blanket margin — identical to the pre-fix behavior.
  const xs = outline.map((p) => p.x);
  const ys = outline.map((p) => p.y);
  assertClose(Math.min(...xs), -margin, 1e-9);
  assertClose(Math.max(...xs), 100 + margin, 1e-9);
  assertClose(Math.min(...ys), -margin, 1e-9);
  assertClose(Math.max(...ys), 100 + margin, 1e-9);

  const plate = buildBasePlate(project.grid, project);
  const bounds = pieceBounds(plate);
  assertClose(bounds.width, 100 + 2 * margin, 1e-9);
  assertClose(bounds.height, 100 + 2 * margin, 1e-9);
});

test('regression: the drawer\'s id prefix does not corrupt SvgPath.pieceLabel\'s positional id.split(\'-\') parsing', () => {
  // pieceLabel derives "Paroi <AXIS><c>,<r>" straight from
  // wallPieceId's `wall-${kind}-${c}-${r}` id format via a positional
  // split('-') — a '-'-delimited prefix would shift every index and
  // corrupt the label (caught live: "Paroi WALLv,0" instead of "Paroi
  // V0,0" when the prefix was originally 'drawer-'). The ':' prefix
  // must not have that problem.
  const project = baseProject();
  project.drawer = { enabled: true, playMm: 1, thicknessMm: 3, openSide: 'right' };
  const pieces = buildDrawerBox(project.grid, project);
  const wallPiece = pieces.find((p) => p.kind === 'wall');
  const label = pieceLabel(wallPiece);
  assert(/^(Paroi|Cloison) [VH]\d+,\d+$/.test(label), `expected a well-formed label like "Paroi V0,0", got "${label}"`);
});

run();
