// "Boîte en tiroir": an independent enclosing sleeve box (own grid, own
// thickness) built around the current box's own outer footprint, open on
// one side — see DrawerBuilder.js's own header comment for the design.
// Always 5 pieces (base + lid + 3 walls), and — since the sleeve has no
// interior dividers at all — never any holes anywhere, on any piece.
import { test, assert, assertClose, run } from './testHarness.js';
import { createGrid } from '../model/Grid.js';
import { createDefaultProject } from '../state/Project.js';
import { buildDrawerBox, buildSleeveContext, computeDrawerOffset, computeDrawerSlideVector, DRAWER_PREFIX } from '../geometry/DrawerBuilder.js';
import { buildBasePlate, buildOuterEdgeOutline } from '../geometry/BasePlateBuilder.js';
import { computePieces } from '../geometry/PieceFactory.js';
import { computePiecePlacement3D, toWorld } from '../geometry/PiecePlacement3D.js';
import { pieceBounds, pieceLabel } from '../geometry/SvgPath.js';

// The real, end-to-end Z extent of a set of pieces in WORLD space — the
// same machinery ThreeJsScene.js actually renders with. Deliberately not
// hand-derived from sleeveH/insertHeightMm/computeDrawerOffset in
// isolation: mixing a sleeve-local (v=0-relative) value with a world
// (main-box-floor-relative) one in a test's own arithmetic is exactly the
// class of mistake that let the real bug here (the sleeve's own flush lid
// eating into the main box's playMm clearance) go unnoticed by an earlier,
// purely-algebraic version of this test.
function worldZRange(pieces, project) {
  let min = Infinity, max = -Infinity;
  for (const piece of pieces) {
    const placement = computePiecePlacement3D(project.grid, project, piece);
    for (const p of piece.outline) {
      for (const z of [0, piece.thicknessMm]) {
        const w = toWorld(placement, { x: p.x, y: p.y, z });
        min = Math.min(min, w.z);
        max = Math.max(max, w.z);
      }
    }
  }
  return { min, max };
}

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
  const drawerThicknessMm = 3;
  project.drawer = { enabled: true, playMm, thicknessMm: drawerThicknessMm, openSide: 'right' };
  const { sleeveProject } = buildSleeveContext(project.grid, project);
  // true height = base plate (3) + walls (50), no lid contribution (disabled),
  // plus the sleeve's OWN flush lid's own thickness (see the next test).
  assertClose(sleeveProject.outerHeightMm, (3 + 50) + 2 * playMm + drawerThicknessMm, 1e-9, 'sleeve interior height must clear base + walls, not walls alone');
});

test('the assembled sleeve clears the main box by exactly playMm on BOTH the floor and the lid side, in real world space', () => {
  const project = baseProject(); // outerThicknessMm 3, outerHeightMm 50, lid disabled
  const playMm = 1;
  const drawerThicknessMm = 3;
  project.drawer = { enabled: true, playMm, thicknessMm: drawerThicknessMm, openSide: 'right' };

  const pieces = computePieces(project);
  const mainPieces = pieces.filter((p) => !p.id.startsWith(DRAWER_PREFIX));
  const drawerPieces = pieces.filter((p) => p.id.startsWith(DRAWER_PREFIX));

  const main = worldZRange(mainPieces, project);
  const sleeve = worldZRange(drawerPieces, project);

  // sleeve.min/.max are OUTER faces (base plate's own bottom, lid's own
  // top) — the real air gap to the main box excludes the sleeve's own
  // material thickness on that side. Tolerance is 0.05mm, not 1e-9: burn
  // correction (project.burnMm) offsets a diagonal outline corner
  // slightly differently on the main box's own outermost corner than on
  // the sleeve's, a sub-tenth-of-a-mm artifact irrelevant at laser-cutting
  // tolerances — nowhere near large enough to mask the 3mm regression this
  // test exists to catch.
  assertClose(main.min - (sleeve.min + drawerThicknessMm), playMm, 0.05, 'floor clearance: main box\'s own bottom above the sleeve\'s own (inner) floor');
  assertClose((sleeve.max - drawerThicknessMm) - main.max, playMm, 0.05, 'lid clearance: the sleeve\'s own lid UNDERSIDE above the main box\'s own real top — not the lid\'s outer face, which is a full drawerThicknessMm further still');
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

// World-space offset that positions the sleeve's own local frame (which,
// like the main box, starts at its own (0,0,0)) against the main box: the
// two are numerically distinct here (outerThicknessMm 3 vs drawer
// thicknessMm 5, playMm 2) specifically so a coordinate mix-up between
// "main box's own thickness" and "sleeve's own thickness" would fail these
// assertions rather than accidentally cancel out.
const OFFSET_CASES = [
  { openSide: 'right', expected: { x: -5, y: -5, z: -7 } }, // open axis x, closed at min (left): closed = -outerThicknessMm - playMm
  { openSide: 'left', expected: { x: -3, y: -5, z: -7 } }, // open axis x, open at min (left): flush = -outerThicknessMm
  { openSide: 'top', expected: { x: -5, y: -3, z: -7 } }, // open axis y, open at min (top): flush = -outerThicknessMm
  { openSide: 'bottom', expected: { x: -5, y: -5, z: -7 } }, // open axis y, closed at min (top): closed = -outerThicknessMm - playMm
];

for (const { openSide, expected } of OFFSET_CASES) {
  test(`computeDrawerOffset(openSide:'${openSide}'): flush on the open end, playMm clear of the main box everywhere else`, () => {
    const project = baseProject();
    project.drawer = { enabled: true, playMm: 2, thicknessMm: 5, openSide };
    const offset = computeDrawerOffset(project);
    assertClose(offset.x, expected.x, 1e-9, 'x');
    assertClose(offset.y, expected.y, 1e-9, 'y');
    assertClose(offset.z, expected.z, 1e-9, 'z');
  });
}

test('computeDrawerSlideVector(openT:0) is the zero vector — the closed/default position', () => {
  const project = baseProject();
  project.drawer = { enabled: true, playMm: 1, thicknessMm: 3, openSide: 'top' };
  const v = computeDrawerSlideVector(project.grid, project, 0);
  assertClose(v.x, 0, 1e-9, 'x');
  assertClose(v.y, 0, 1e-9, 'y');
  assertClose(v.z, 0, 1e-9, 'z');
});

test('computeDrawerSlideVector: slides along the open axis, away from the closed side, by openT * the main box\'s own extent on that axis', () => {
  const project = baseProject(); // grid [100],[100], outerThicknessMm 3 -> outerBoxWidth/Depth = 106
  project.drawer = { enabled: true, playMm: 1, thicknessMm: 3, openSide: 'right' };
  const half = computeDrawerSlideVector(project.grid, project, 0.5);
  assertClose(half.x, 53, 1e-9, 'right, openT 0.5: +half of outerBoxWidth (106)');
  assertClose(half.y, 0, 1e-9, 'right: no y component');

  project.drawer.openSide = 'left';
  const full = computeDrawerSlideVector(project.grid, project, 1);
  assertClose(full.x, -106, 1e-9, 'left, openT 1: -outerBoxWidth (exits toward -x)');

  project.drawer.openSide = 'bottom';
  const bottom = computeDrawerSlideVector(project.grid, project, 1);
  assertClose(bottom.x, 0, 1e-9, 'bottom: no x component');
  assertClose(bottom.y, 106, 1e-9, 'bottom, openT 1: +outerBoxDepth (exits toward +y)');
});

run();
