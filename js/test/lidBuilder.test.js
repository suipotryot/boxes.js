// M5 (scope-cut 2026-08-20 to a fixed lid only, no floating variant): a
// flat W×D sheet jointing only with the 4 outer walls, at a configurable
// insertion height — insertHeightMm is where the lid's BOTTOM face rests
// (see GridQuery.lidTopFace/isLidFlush), unlike every other height field
// in this app (a top-face convention) — a horizontal panel with its own
// thickness needs "the height it rests at" as the user-facing quantity,
// not its top face, or 2026-08-21's real-world defect (a lid landing one
// thickness too low because insertHeightMm silently meant "top face")
// recurs. Two cases: FLUSH (its top face === perimeter height) mirrors
// the base plate — notches cut into the lid, tabs protrude from each
// outer wall's own top edge. RECESSED (top face < perimeter height,
// walls continue above as a rim) mirrors a T junction — the lid
// protrudes its own tabs, the walls get enclosed mortise holes mid-height
// instead.
import { test, assert, assertClose, run } from './testHarness.js';
import { createGrid, setSegmentHeight } from '../model/Grid.js';
import { enumerateWallRuns, validateLid } from '../model/GridQuery.js';
import { buildWallPanel } from '../geometry/PanelBuilder.js';
import { buildBasePlate } from '../geometry/BasePlateBuilder.js';
import { buildLid } from '../geometry/LidBuilder.js';
import { computePieces } from '../geometry/PieceFactory.js';
import { burnCorrect } from '../geometry/BurnCorrection.js';
import { createDefaultProject } from '../state/Project.js';
import { pieceBounds } from '../geometry/SvgPath.js';

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

test('validateLid: within range is ok, reports the true min/max', () => {
  const project = createDefaultProject();
  project.grid = createGrid([100], [100]); // no interior dividers: min is 0
  assert(validateLid(project.grid, project, 25).ok);
  const r = validateLid(project.grid, project, 25);
  assertClose(r.min, 0, 1e-9);
  assertClose(r.max, 47, 1e-9, 'max should be the perimeter height (outerHeightMm default) minus the lid\'s own thickness, so its top face never exceeds the perimeter');
});

test('validateLid: rejects below the tallest interior divider and above the perimeter height (minus lid thickness)', () => {
  const project = createDefaultProject();
  project.grid = createGrid([80, 80], [100]);
  project.grid = setSegmentHeight(project.grid, 'v', 1, 0, 30); // interior divider, 30mm
  assert(!validateLid(project.grid, project, 20).ok, 'below the 30mm divider should be rejected');
  assert(validateLid(project.grid, project, 30).ok, 'resting exactly at the divider height should be accepted — its bottom face clears the divider with nothing to spare');
  assert(validateLid(project.grid, project, 47).ok, 'resting at perimeter height (50) minus the 3mm lid thickness should be accepted — its top face lands exactly flush');
  assert(!validateLid(project.grid, project, 50).ok, 'resting at the perimeter height itself should be rejected — its top face would stick out 3mm above the walls');
  assert(!validateLid(project.grid, project, null).ok, 'null should be rejected, not silently pass');
});

test('buildLid returns null when disabled', () => {
  const project = createDefaultProject();
  project.grid = createGrid([150], [100]);
  assert(buildLid(project.grid, project) === null);
  assert(!computePieces(project).some((p) => p.kind === 'lid'), 'computePieces should not include a lid piece when disabled');
});

test('buildLid, flush case: mirrors the base plate\'s own footprint (notches, not tabs)', () => {
  const project = createDefaultProject();
  project.grid = createGrid([150], [100]);
  project.lid = { enabled: true, insertHeightMm: 47 }; // top face === perimeter height (default outerHeightMm 50, minus the 3mm default lid thickness)
  const lid = buildLid(project.grid, project);
  assert(lid !== null);
  assert(isSimplePolygon(lid.outline), 'flush lid outline self-intersects');
  const plate = buildBasePlate(project.grid, project);
  const lidBounds = pieceBounds(lid);
  const plateBounds = pieceBounds(plate);
  assertClose(lidBounds.width, plateBounds.width, 1e-6, 'a flush lid should span the same footprint as the base plate');
  assertClose(lidBounds.height, plateBounds.height, 1e-6);
});

test('buildLid, recessed case: protrudes its own tabs past the nominal W x D footprint', () => {
  const project = createDefaultProject();
  project.grid = createGrid([150], [100]);
  project.lid = { enabled: true, insertHeightMm: 30 }; // below the 50mm perimeter
  const lid = buildLid(project.grid, project);
  assert(isSimplePolygon(lid.outline), 'recessed lid outline self-intersects');
  const bounds = pieceBounds(lid);
  assert(bounds.width > 150, `expected tabs to protrude past the nominal 150mm width, got ${bounds.width}`);
  assert(bounds.height > 100, `expected tabs to protrude past the nominal 100mm height, got ${bounds.height}`);
});

test('outer wall, flush lid: its own top edge grows protruding tabs, no enclosed holes', () => {
  const project = createDefaultProject();
  project.grid = createGrid([150], [100]);
  project.lid = { enabled: true, insertHeightMm: 47 }; // top face === perimeter height (50) once the 3mm lid thickness is added
  const runs = enumerateWallRuns(project.grid, project);
  const topRun = runs.find((r) => r.kind === 'h' && r.r === 0);
  const piece = buildWallPanel(topRun, project.grid, project, true);
  assert(isSimplePolygon(piece.outline), 'flush-lid wall outline self-intersects');
  assert(piece.holes.length === 0, 'the flush case joints via the free edge shape, not holes');
  const ys = piece.outline.map((p) => p.y);
  assert(ys.some((y) => y > 50 + 1e-6), 'expected the wall\'s own top edge to protrude above the nominal 50mm height at finger positions');
});

test('outer wall, recessed lid: its own top edge stays flat, gets enclosed holes at insertHeightMm instead', () => {
  const project = createDefaultProject();
  project.grid = createGrid([150], [100]);
  project.lid = { enabled: true, insertHeightMm: 30 };
  const runs = enumerateWallRuns(project.grid, project);
  const topRun = runs.find((r) => r.kind === 'h' && r.r === 0);
  const piece = buildWallPanel(topRun, project.grid, project, true);
  assert(isSimplePolygon(piece.outline), 'recessed-lid wall outline self-intersects');
  const ys = piece.outline.map((p) => p.y);
  assertClose(Math.max(...ys), 50, 1e-6, 'the wall should stay flat at its full 50mm height — it continues as a rim above the lid');
  assert(piece.holes.length > 0, 'expected enclosed holes for the recessed lid\'s tabs');
  for (const hole of piece.holes) {
    assert(isSimplePolygon(hole), 'lid hole should be a simple rectangle');
    const hys = hole.map((p) => p.y);
    assertClose(Math.min(...hys), 30, 1e-9, 'hole bottom should sit exactly at insertHeightMm — the height the lid rests at');
    assertClose(Math.max(...hys), 30 + project.outerThicknessMm, 1e-9, 'hole top should be one lid-thickness above insertHeightMm');
  }
});

test('an interior divider is never affected by the lid, recessed or flush', () => {
  const project = createDefaultProject();
  project.grid = createGrid([80, 80], [100]); // T junction: interior divider at c=1
  project.outerThicknessMm = 3;
  project.innerThicknessMm = 5;
  const runs = enumerateWallRuns(project.grid, project);
  const divider = runs.find((r) => r.kind === 'v' && r.c === 1);

  const withoutLid = buildWallPanel(divider, project.grid, project, true);

  project.lid = { enabled: true, insertHeightMm: 30 };
  const withRecessedLid = buildWallPanel(divider, project.grid, project, true);
  assert(withRecessedLid.holes.length === withoutLid.holes.length, 'a recessed lid must not add holes to an interior divider');

  project.lid = { enabled: true, insertHeightMm: 47 }; // top face === perimeter height (50) once the 3mm lid thickness is added
  const withFlushLid = buildWallPanel(divider, project.grid, project, true);
  const ysNoLid = withoutLid.outline.map((p) => p.y);
  const ysFlushLid = withFlushLid.outline.map((p) => p.y);
  assertClose(Math.max(...ysNoLid), Math.max(...ysFlushLid), 1e-9, 'a flush lid must not add protruding tabs to an interior divider');
});

test('recessed lid holes stay simple and shrink (not grow) after burn correction — winding sanity check', () => {
  const project = createDefaultProject();
  project.grid = createGrid([150], [100]);
  project.lid = { enabled: true, insertHeightMm: 30 };
  const pieces = computePieces(project); // already burn-corrected
  const topWall = pieces.find((p) => p.id === 'wall-h-0-0');
  assert(topWall.holes.length > 0);
  for (const hole of topWall.holes) {
    assert(isSimplePolygon(hole), 'burn-corrected lid hole self-intersects');
    const ys = hole.map((p) => p.y);
    const height = Math.max(...ys) - Math.min(...ys);
    assert(height < project.outerThicknessMm, `burn-corrected hole height (${height}) should be smaller than the nominal lid thickness (${project.outerThicknessMm}) — a sign-flip regression would grow it instead`);
  }
});

test('flush and recessed lid outlines both stay simple after burn correction', () => {
  const project = createDefaultProject();
  project.grid = createGrid([150], [100]);

  project.lid = { enabled: true, insertHeightMm: 47 }; // top face === perimeter height (50) once the 3mm lid thickness is added
  const flushLid = burnCorrect(buildLid(project.grid, project), project.burnMm);
  assert(isSimplePolygon(flushLid.outline), 'burn-corrected flush lid self-intersects');

  project.lid = { enabled: true, insertHeightMm: 30 };
  const recessedLid = burnCorrect(buildLid(project.grid, project), project.burnMm);
  assert(isSimplePolygon(recessedLid.outline), 'burn-corrected recessed lid self-intersects');
});

run();
