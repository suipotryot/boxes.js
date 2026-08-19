// PanelBuilder now builds one piece per *run* (GridQuery.enumerateWallRuns)
// rather than one per grid cell — a plain side of the box is one physical
// piece, an uncustomized divider is one physical piece, matching what
// actually gets cut. T junctions (a divider's end landing mid-span on a
// through-piece) are mortise holes; X crossings (two through-pieces
// crossing each other) are half-lap notches on both.
import { test, assert, assertClose, run } from './testHarness.js';
import { createGrid, setSegmentHeight, toggleWall } from '../model/Grid.js';
import { enumerateWallRuns } from '../model/GridQuery.js';
import { buildWallPanel } from '../geometry/PanelBuilder.js';
import { buildBasePlate } from '../geometry/BasePlateBuilder.js';
import { computePieces } from '../geometry/PieceFactory.js';
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
function xExtent(outline) {
  const xs = outline.map((p) => p.x);
  return { minX: Math.min(...xs), maxX: Math.max(...xs) };
}
function findRun(runs, kind, matchFn) {
  const r = runs.find((x) => x.kind === kind && matchFn(x));
  assert(r, `run ${kind} not found`);
  return r;
}

const project = createDefaultProject();
project.grid = createGrid([150], [100]);

test('a single-cell box produces exactly 4 simple, non-self-intersecting wall outlines (one per side)', () => {
  const runs = enumerateWallRuns(project.grid);
  assert(runs.length === 4, `expected 4 runs (one per side) for a single-cell box, got ${runs.length}`);
  for (const run of runs) {
    const piece = buildWallPanel(run, project.grid, project, true);
    assert(piece.outline.length >= 4, `${piece.id} should have at least 4 points`);
    assert(isSimplePolygon(piece.outline), `${piece.id} outline self-intersects`);
    assert(piece.holes.length === 0, `${piece.id} should have no holes (no interior dividers)`);
  }
});

test('a wall panel bounding box roughly matches its length x height', () => {
  const runs = enumerateWallRuns(project.grid);
  const vRun = findRun(runs, 'v', (r) => r.c === 0);
  const piece = buildWallPanel(vRun, project.grid, project, true);
  const bounds = pieceBounds(piece);
  assert(bounds.width > 95 && bounds.width < 105, `unexpected length span: ${bounds.width}`);
  assert(bounds.height > 45 && bounds.height < 55, `unexpected height span: ${bounds.height}`);
});

test('different mate thickness at each end still produces a simple outline', () => {
  const mixed = createDefaultProject();
  mixed.grid = createGrid([150], [100]);
  mixed.outerThicknessMm = 3;
  mixed.innerThicknessMm = 8; // deliberately not a clean ratio, per the known regression pattern
  const runs = enumerateWallRuns(mixed.grid);
  for (const run of runs) {
    const piece = buildWallPanel(run, mixed.grid, mixed, true);
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

test('T junction: the divider is one piece protruding by the outer edge half-thickness at both ends', () => {
  const t = createDefaultProject();
  t.grid = createGrid([80, 80], [100]); // 2 cols x 1 row: one interior vertical divider, no X crossing
  t.outerThicknessMm = 3;
  t.innerThicknessMm = 5;
  const runs = enumerateWallRuns(t.grid);
  assert(runs.length === 5, `expected 5 runs (4 outer sides + 1 divider), got ${runs.length}`);
  const divider = findRun(runs, 'v', (r) => r.c === 1);
  const piece = buildWallPanel(divider, t.grid, t, true);
  assert(isSimplePolygon(piece.outline), 'divider outline self-intersects');
  assert(piece.holes.length === 0, 'a T-junction stem itself has no mortise holes — it has the ordinary end comb');
  const { minX, maxX } = xExtent(piece.outline);
  assertClose(minX, -1.5, 1e-6, 'divider top-end protrusion should be outerThickness/2');
  assertClose(maxX - 100, 1.5, 1e-6, 'divider bottom-end protrusion should be outerThickness/2');
});

test('T junction: the through-wall stays one piece and gets a mortise hole sized to the divider\'s own thickness', () => {
  const t = createDefaultProject();
  t.grid = createGrid([80, 80], [100]);
  t.outerThicknessMm = 3;
  t.innerThicknessMm = 5;
  const runs = enumerateWallRuns(t.grid);
  const topRun = findRun(runs, 'h', (r) => r.r === 0);
  assertClose(topRun.length, 160, 1e-9, 'the top run should span both columns as one piece, not split at the divider');
  const piece = buildWallPanel(topRun, t.grid, t, true);
  assert(isSimplePolygon(piece.outline), 'through-wall outline self-intersects');
  assert(piece.holes.length === 2, `expected 2 mortise holes (one per finger of the divider's default 50mm-tall end comb), got ${piece.holes.length}`);
  for (const hole of piece.holes) {
    assert(isSimplePolygon(hole), 'mortise hole should be a simple rectangle');
    const xs = hole.map((p) => p.x);
    const width = Math.max(...xs) - Math.min(...xs);
    assertClose(width, 5, 1e-9, 'mortise hole width should equal the divider\'s own (inner) thickness');
    const center = (Math.max(...xs) + Math.min(...xs)) / 2;
    assertClose(center, 80, 1e-9, 'mortise hole should be centered on the divider\'s crossing position');
  }
});

test('X crossing: both dividers stay one piece each, with a half-lap notch and no holes', () => {
  const x = createDefaultProject();
  x.grid = createGrid([90, 130], [70, 100]); // 2x2: two interior dividers cross once
  x.outerThicknessMm = 3;
  x.innerThicknessMm = 6;
  const runs = enumerateWallRuns(x.grid);
  assert(runs.length === 6, `expected 6 runs (4 outer sides + 2 full-length dividers), got ${runs.length}`);
  const vDivider = findRun(runs, 'v', (r) => r.c === 1);
  const hDivider = findRun(runs, 'h', (r) => r.r === 1);
  assertClose(vDivider.length, 170, 1e-9, 'the vertical divider should span both rows as one piece');
  assertClose(hDivider.length, 220, 1e-9, 'the horizontal divider should span both columns as one piece');

  const vPiece = buildWallPanel(vDivider, x.grid, x, true);
  const hPiece = buildWallPanel(hDivider, x.grid, x, true);
  assert(isSimplePolygon(vPiece.outline), 'vertical divider outline self-intersects at the X crossing');
  assert(isSimplePolygon(hPiece.outline), 'horizontal divider outline self-intersects at the X crossing');
  assert(vPiece.holes.length === 0, 'an X-crossing piece gets a notch, not a mortise hole');
  assert(hPiece.holes.length === 0, 'an X-crossing piece gets a notch, not a mortise hole');

  // The vertical divider notches from the top: somewhere in its outline
  // there should be a point dipping down to exactly height/2 (the notch
  // floor) — checked directly rather than via the outline's global min,
  // since the bottom edge's own base-plate finger comb legitimately goes
  // further negative (into the base plate) and isn't the notch at all.
  const height = 50;
  const vYs = vPiece.outline.map((p) => p.y);
  assert(vYs.some((y) => Math.abs(y - height / 2) < 0.01), 'vertical divider notch should dip to exactly half height');

  // The horizontal divider notches from the bottom: its outline should
  // rise up to height/2 from y=0, and never above it.
  const hYs = hPiece.outline.map((p) => p.y);
  assertClose(Math.max(...hYs), height, 0.01, 'horizontal divider top should stay untouched');
  assert(hYs.some((y) => Math.abs(y - height / 2) < 0.01), 'horizontal divider notch should rise to exactly half height');
});

test('M2 example: a 2x2 grid with internal dividers produces exactly 7 pieces (1 base + 4 sides + 2 dividers), all simple', () => {
  const m2 = createDefaultProject();
  m2.grid = createGrid([90, 130], [70, 100]);
  const runs = enumerateWallRuns(m2.grid);
  const wallPieces = runs.map((run) => buildWallPanel(run, m2.grid, m2, true));
  const plate = buildBasePlate(m2.grid, m2);
  const allPieces = [...wallPieces, plate];
  assert(allPieces.length === 7, `expected 7 pieces total, got ${allPieces.length}`);
  for (const piece of allPieces) {
    assert(isSimplePolygon(piece.outline), `${piece.id} outline self-intersects`);
    for (const hole of piece.holes) assert(isSimplePolygon(hole), `${piece.id} has a self-intersecting hole`);
  }
});

test('a height difference along a divider stays one piece with a stepped profile, not two pieces', () => {
  const t = createDefaultProject();
  t.grid = createGrid([80, 80], [50, 50]); // 2 cols x 2 rows: divider at c=1 is 2 cells
  t.grid = toggleWall(t.grid, 'h', 0, 1); // no crossing divider at the row boundary —
  t.grid = toggleWall(t.grid, 'h', 1, 1); // isolate the height-step from any T/X junction
  t.grid = setSegmentHeight(t.grid, 'v', 1, 1, 30); // bottom cell shorter than the top cell (50)
  const runs = enumerateWallRuns(t.grid);
  const dividerRuns = runs.filter((r) => r.kind === 'v' && r.c === 1);
  assert(dividerRuns.length === 1, `a height-only difference should stay one piece, got ${dividerRuns.length}`);

  const piece = buildWallPanel(dividerRuns[0], t.grid, t, true);
  assert(isSimplePolygon(piece.outline), 'stepped-height divider outline self-intersects');

  // The end nearer the shorter cell (bPoint, bottom) should comb only up
  // to that cell's own height, not the taller cell's — this is the same
  // "each end uses its own local mate/height" discipline as junctions.
  const ys = piece.outline.map((p) => p.y);
  assert(ys.every((y) => y <= 50 + 1e-6), 'no point should exceed the taller cell\'s height');
  assert(ys.some((y) => Math.abs(y - 30) < 1e-6), 'the outline should reach exactly the shorter cell\'s height at the step');
  assert(ys.some((y) => Math.abs(y - 50) < 1e-6), 'the outline should still reach the taller cell\'s height elsewhere');
});

test('a removed segment still splits a divider into two pieces even with heights otherwise matching', () => {
  const t = createDefaultProject();
  t.grid = createGrid([80, 80], [50, 50]);
  t.grid = toggleWall(t.grid, 'h', 0, 1);
  t.grid = toggleWall(t.grid, 'h', 1, 1);
  t.grid = toggleWall(t.grid, 'v', 1, 1); // remove the bottom cell entirely — a real gap
  const runs = enumerateWallRuns(t.grid);
  const dividerRuns = runs.filter((r) => r.kind === 'v' && r.c === 1);
  assert(dividerRuns.length === 1, `expected exactly 1 remaining piece (the top cell), got ${dividerRuns.length}`);
  assertClose(dividerRuns[0].length, 50, 1e-9, 'the remaining piece should be just the top cell\'s span');
});

// X crossing, unequal heights: the notch must be sized to half of the
// SHORTER of the two crossing pieces, on BOTH pieces — never either
// piece's own height taken alone (that would either overlap or leave a
// gap where they're supposed to interlock; see PanelBuilder's
// splitHeight() docstring for the derivation).
function xCrossingGrid(hHeight, vHeight) {
  const t = createDefaultProject();
  t.grid = createGrid([90, 130], [70, 100]);
  t.grid = setSegmentHeight(t.grid, 'h', 0, 1, hHeight);
  t.grid = setSegmentHeight(t.grid, 'h', 1, 1, hHeight);
  t.grid = setSegmentHeight(t.grid, 'v', 1, 0, vHeight);
  t.grid = setSegmentHeight(t.grid, 'v', 1, 1, vHeight);
  const runs = enumerateWallRuns(t.grid);
  const v = buildWallPanel(runs.find((r) => r.kind === 'v' && r.c === 1), t.grid, t, true);
  const h = buildWallPanel(runs.find((r) => r.kind === 'h' && r.r === 1), t.grid, t, true);
  return { v, h };
}

test('X crossing: the horizontal piece (shorter) keeps its ordinary edge notch, the vertical piece (taller) gets an enclosed hole instead', () => {
  const { v, h } = xCrossingGrid(30, 50); // h shorter than v
  assert(isSimplePolygon(v.outline) && isSimplePolygon(h.outline), 'outlines self-intersect');
  assert(v.holes.length === 1, `the taller (v) piece should get exactly 1 enclosed half-lap hole, got ${v.holes.length}`);
  assert(isSimplePolygon(v.holes[0]), 'the half-lap hole should be a simple rectangle');
  const holeYs = v.holes[0].map((p) => p.y);
  assertClose(Math.min(...holeYs), 15, 1e-9, 'hole should start at half of the shorter (30mm) height');
  assertClose(Math.max(...holeYs), 30, 1e-9, 'hole should end exactly at the shorter piece\'s own height, not touch the taller piece\'s own top (50)');
  const holeXs = v.holes[0].map((p) => p.x);
  assertClose(Math.max(...holeXs) - Math.min(...holeXs), 3, 1e-9, 'hole width should equal the shorter (h) piece\'s own thickness');

  // h stays a plain edge notch (no hole) — v=0 is h's own true edge either way.
  assert(h.holes.length === 0, 'the shorter (h) piece should have no enclosed hole, only its ordinary edge notch');
});

test('X crossing: roles reversed (v shorter than h) — same rule, opposite piece gets the hole', () => {
  const { v, h } = xCrossingGrid(50, 30); // v shorter than h
  assert(isSimplePolygon(v.outline) && isSimplePolygon(h.outline), 'outlines self-intersect');
  assert(v.holes.length === 0, 'the now-shorter (v) piece should have no enclosed hole');
  assert(h.holes.length === 0, 'h always uses a plain edge notch regardless of which side is shorter');
  // v's own free edge should dip to half of the shorter (its own, 30) height.
  const vYs = v.outline.map((p) => p.y);
  assert(vYs.some((y) => Math.abs(y - 15) < 1e-9), 'v\'s edge notch should reach exactly half of its own (shorter) height');
});

test('X crossing: equal (but both shortened) heights stay symmetric with no holes on either side', () => {
  const { v, h } = xCrossingGrid(30, 30);
  assert(v.holes.length === 0 && h.holes.length === 0, 'equal heights should never need an enclosed hole on either piece');
  assert(isSimplePolygon(v.outline) && isSimplePolygon(h.outline), 'outlines self-intersect');
});

test('X crossing: the half-lap hole shrinks (not grows) under burn correction', () => {
  const t = createDefaultProject();
  t.grid = createGrid([90, 130], [70, 100]);
  t.grid = setSegmentHeight(t.grid, 'h', 0, 1, 30);
  t.grid = setSegmentHeight(t.grid, 'h', 1, 1, 30);
  const pieces = computePieces(t);
  const v = pieces.find((p) => p.id === 'wall-v-1-0');
  assert(v.holes.length === 1);
  const xs = v.holes[0].map((p) => p.x);
  const ys = v.holes[0].map((p) => p.y);
  const width = Math.max(...xs) - Math.min(...xs);
  const height = Math.max(...ys) - Math.min(...ys);
  assert(width < 3, `burn-corrected hole width (${width}) should be smaller than nominal (3)`);
  assert(height < 15, `burn-corrected hole height (${height}) should be smaller than nominal (15)`);
});

test('X crossing coinciding exactly with a height step on the OTHER run: both pieces still use the true shorter height, not one arbitrary side of the step', () => {
  // Only the cell on ONE side of the crossing is shortened, so the
  // horizontal divider's own height step lands exactly on the same grid
  // point as the X crossing with the vertical divider. Reported by the
  // user reproducing this exact edit through the real editor.
  const t = createDefaultProject();
  t.grid = createGrid([90, 130], [70, 100]);
  t.grid = setSegmentHeight(t.grid, 'h', 1, 1, 20); // only the right cell of the horizontal divider
  const runs = enumerateWallRuns(t.grid);
  const hPiece = buildWallPanel(runs.find((r) => r.kind === 'h' && r.r === 1), t.grid, t, true);
  const vPiece = buildWallPanel(runs.find((r) => r.kind === 'v' && r.c === 1), t.grid, t, true);
  assert(isSimplePolygon(hPiece.outline), 'h outline self-intersects at the coincident step/crossing');
  assert(isSimplePolygon(vPiece.outline), 'v outline self-intersects at the coincident step/crossing');

  // The true local height of h right at the crossing is 20 (the shorter,
  // customized side) — not 50 (the unmodified side), regardless of which
  // side a naive "resolve at this exact boundary" lookup might pick.
  assert(vPiece.holes.length === 1, `v (taller, 50) should get exactly 1 enclosed hole, got ${vPiece.holes.length}`);
  assert(isSimplePolygon(vPiece.holes[0]), 'v\'s half-lap hole should be simple');
  const holeYs = vPiece.holes[0].map((p) => p.y);
  assertClose(Math.min(...holeYs), 10, 1e-6, 'hole should start at half of the true shorter height (20/2=10), not half of 50');
  assertClose(Math.max(...holeYs), 20, 1e-6, 'hole should end at the true shorter height (20), not touch v\'s own top (50)');
});

run();
