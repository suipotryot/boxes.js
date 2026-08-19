import { test, assert, assertClose, run } from './testHarness.js';
import { createGrid } from '../model/Grid.js';
import { enumerateWallSegments } from '../model/GridQuery.js';
import { buildWallPanel } from '../geometry/PanelBuilder.js';
import { buildBasePlate } from '../geometry/BasePlateBuilder.js';
import { createDefaultProject } from '../state/Project.js';
import { pieceBounds } from '../geometry/SvgPath.js';

function segmentsIntersect(p1, p2, p3, p4) {
  const d1 = cross(sub(p4, p3), sub(p1, p3));
  const d2 = cross(sub(p4, p3), sub(p2, p3));
  const d3 = cross(sub(p2, p1), sub(p3, p1));
  const d4 = cross(sub(p2, p1), sub(p4, p1));
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  return false;
}
function sub(a, b) { return { x: a.x - b.x, y: a.y - b.y }; }
function cross(a, b) { return a.x * b.y - a.y * b.x; }

function isSimplePolygon(points) {
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const a1 = points[i], a2 = points[(i + 1) % n];
    for (let j = i + 1; j < n; j++) {
      if (j === i) continue;
      const shareVertex = j === i || (j + 1) % n === i || j === (i + 1) % n;
      if (shareVertex) continue;
      const b1 = points[j], b2 = points[(j + 1) % n];
      if (segmentsIntersect(a1, a2, b1, b2)) return false;
    }
  }
  return true;
}

const project = createDefaultProject();
project.grid = createGrid([150], [100]);

test('a plain outer wall produces a simple, closed, non-self-intersecting outline', () => {
  const walls = enumerateWallSegments(project.grid);
  for (const w of walls) {
    const piece = buildWallPanel(w, project.grid, project, true);
    assert(piece.outline.length >= 4, `${piece.id} should have at least 4 points`);
    assert(isSimplePolygon(piece.outline), `${piece.id} outline self-intersects`);
  }
});

test('a wall panel bounding box roughly matches its length x height', () => {
  const walls = enumerateWallSegments(project.grid);
  const vWall = walls.find((w) => w.kind === 'v');
  const piece = buildWallPanel(vWall, project.grid, project, true);
  const bounds = pieceBounds(piece);
  // length (sy=100) plus small protrusions on each end (mate half-thickness)
  assert(bounds.width > 95 && bounds.width < 105, `unexpected length span: ${bounds.width}`);
  assert(bounds.height > 45 && bounds.height < 55, `unexpected height span: ${bounds.height}`);
});

test('different mate thickness at each end still produces a simple outline', () => {
  const mixed = createDefaultProject();
  mixed.grid = createGrid([150], [100]);
  mixed.outerThicknessMm = 3;
  mixed.innerThicknessMm = 8; // deliberately not a clean ratio, per the known regression pattern
  const walls = enumerateWallSegments(mixed.grid);
  for (const w of walls) {
    const piece = buildWallPanel(w, mixed.grid, mixed, true);
    assert(isSimplePolygon(piece.outline), `${piece.id} self-intersects with mixed thickness`);
  }
});

test('base plate outline is simple and closed for a single-cell box', () => {
  const plate = buildBasePlate(project.grid, project);
  assert(isSimplePolygon(plate.outline), 'base plate outline self-intersects');
  const bounds = pieceBounds(plate);
  assertClose(bounds.width, 150, 0.5, 'plate width');
  assertClose(bounds.height, 100, 0.5, 'plate height');
});

// M2: T junctions and the X crossing must use *the mate's* half-thickness
// at each end independently — never the wall's own thickness, never a
// value shared uniformly across both ends of the same wall. Depth is read
// off the built outline (finger points sit at x = -half at the u=0 end and
// x = length + half at the u=length end; see PanelBuilder's endEdgePoints).
function findWall(walls, kind, c, r) {
  const w = walls.find((x) => x.kind === kind && x.c === c && x.r === r);
  assert(w, `wall ${kind} ${c},${r} not found`);
  return w;
}
function xExtent(outline) {
  const xs = outline.map((p) => p.x);
  return { minX: Math.min(...xs), maxX: Math.max(...xs) };
}

test('T junction: the stem divider protrudes by the outer edge half-thickness at both ends, not its own inner thickness', () => {
  const t = createDefaultProject();
  t.grid = createGrid([80, 80], [100]); // 2 cols x 1 row: one interior vertical divider
  t.outerThicknessMm = 3;
  t.innerThicknessMm = 5;
  const walls = enumerateWallSegments(t.grid);
  const divider = findWall(walls, 'v', 1, 0);
  const piece = buildWallPanel(divider, t.grid, t, true);
  assert(isSimplePolygon(piece.outline), 'T-junction divider outline self-intersects');
  const { minX, maxX } = xExtent(piece.outline);
  assertClose(minX, -1.5, 1e-6, 'divider top-end protrusion should be outerThickness/2');
  assertClose(maxX - 100, 1.5, 1e-6, 'divider bottom-end protrusion should be outerThickness/2');
});

test('T junction: each through-wall half uses its own end\'s mate independently', () => {
  const t = createDefaultProject();
  t.grid = createGrid([80, 80], [100]);
  t.outerThicknessMm = 3;
  t.innerThicknessMm = 5;
  const walls = enumerateWallSegments(t.grid);
  const throughHalf = findWall(walls, 'h', 0, 0); // left half of the top edge
  const piece = buildWallPanel(throughHalf, t.grid, t, true);
  assert(isSimplePolygon(piece.outline), 'through-wall outline self-intersects');
  const { minX, maxX } = xExtent(piece.outline);
  assertClose(minX, -1.5, 1e-6, 'outer-corner end should protrude by outerThickness/2');
  assertClose(maxX - 80, 2.5, 1e-6, 'T-junction end should protrude by innerThickness/2, not outerThickness/2');
});

test('X crossing: all four converging walls protrude by half the inner divider thickness', () => {
  const x = createDefaultProject();
  x.grid = createGrid([90, 130], [70, 100]); // 2x2: two interior dividers cross at the center
  x.outerThicknessMm = 3;
  x.innerThicknessMm = 7;
  const walls = enumerateWallSegments(x.grid);
  const vAbove = findWall(walls, 'v', 1, 0); // ends at the crossing (bPoint)
  const vBelow = findWall(walls, 'v', 1, 1); // starts at the crossing (aPoint)
  const hLeft = findWall(walls, 'h', 0, 1); // ends at the crossing (bPoint)
  const hRight = findWall(walls, 'h', 1, 1); // starts at the crossing (aPoint)

  const pAbove = buildWallPanel(vAbove, x.grid, x, true);
  const pBelow = buildWallPanel(vBelow, x.grid, x, true);
  const pLeft = buildWallPanel(hLeft, x.grid, x, true);
  const pRight = buildWallPanel(hRight, x.grid, x, true);

  assertClose(xExtent(pAbove.outline).maxX - 70, 3.5, 1e-6, 'vAbove crossing-end protrusion');
  assertClose(xExtent(pBelow.outline).minX, -3.5, 1e-6, 'vBelow crossing-end protrusion');
  assertClose(xExtent(pLeft.outline).maxX - 90, 3.5, 1e-6, 'hLeft crossing-end protrusion');
  assertClose(xExtent(pRight.outline).minX, -3.5, 1e-6, 'hRight crossing-end protrusion');
});

test('M2 example: a 2x2 grid with internal dividers (T junctions + an X crossing) produces simple, non-self-intersecting outlines everywhere', () => {
  const m2 = createDefaultProject();
  m2.grid = createGrid([90, 130], [70, 100]);
  const walls = enumerateWallSegments(m2.grid);
  assert(walls.length === 12, `expected 12 wall segments in a 2x2 grid, got ${walls.length}`);
  for (const w of walls) {
    const piece = buildWallPanel(w, m2.grid, m2, true);
    assert(isSimplePolygon(piece.outline), `${piece.id} outline self-intersects`);
  }
  const plate = buildBasePlate(m2.grid, m2);
  assert(isSimplePolygon(plate.outline), 'M2 base plate outline self-intersects');
});

run();
