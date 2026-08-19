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

run();
