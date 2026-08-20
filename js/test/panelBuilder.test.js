// PanelBuilder now builds one piece per *run* (GridQuery.enumerateWallRuns)
// rather than one per grid cell — a plain side of the box is one physical
// piece, an uncustomized divider is one physical piece, matching what
// actually gets cut. T junctions (a divider's end landing mid-span on a
// through-piece) are mortise holes; X crossings (two through-pieces
// crossing each other) are half-lap notches on both.
import { test, assert, assertClose, run } from './testHarness.js';
import { createGrid, setSegmentHeight, toggleWall } from '../model/Grid.js';
import { enumerateWallRuns } from '../model/GridQuery.js';
import { buildWallPanel, bottomCombSegments } from '../geometry/PanelBuilder.js';
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
  const runs = enumerateWallRuns(project.grid, project);
  assert(runs.length === 4, `expected 4 runs (one per side) for a single-cell box, got ${runs.length}`);
  for (const run of runs) {
    const piece = buildWallPanel(run, project.grid, project, true);
    assert(piece.outline.length >= 4, `${piece.id} should have at least 4 points`);
    assert(isSimplePolygon(piece.outline), `${piece.id} outline self-intersects`);
    assert(piece.holes.length === 0, `${piece.id} should have no holes (no interior dividers)`);
  }
});

test('a wall panel bounding box roughly matches its length x height', () => {
  const runs = enumerateWallRuns(project.grid, project);
  const vRun = findRun(runs, 'v', (r) => r.c === 0);
  const piece = buildWallPanel(vRun, project.grid, project, true);
  const bounds = pieceBounds(piece);
  // 100 nominal length + a full 3mm outer-thickness protrusion at each end
  // (both corners mate with the outer top/bottom edge, full thickness now,
  // not half) = 106.
  assert(bounds.width > 95 && bounds.width < 110, `unexpected length span: ${bounds.width}`);
  assert(bounds.height > 45 && bounds.height < 55, `unexpected height span: ${bounds.height}`);
});

test('different mate thickness at each end still produces a simple outline', () => {
  const mixed = createDefaultProject();
  mixed.grid = createGrid([150], [100]);
  mixed.outerThicknessMm = 3;
  mixed.innerThicknessMm = 8; // deliberately not a clean ratio, per the known regression pattern
  const runs = enumerateWallRuns(mixed.grid, mixed);
  for (const run of runs) {
    const piece = buildWallPanel(run, mixed.grid, mixed, true);
    assert(isSimplePolygon(piece.outline), `${piece.id} self-intersects with mixed thickness`);
  }
});

test('base plate outline is simple and closed for a single-cell box', () => {
  const plate = buildBasePlate(project.grid, project);
  assert(isSimplePolygon(plate.outline), 'base plate outline self-intersects');
  const bounds = pieceBounds(plate);
  // 150/100 nominal (the compartment span) + a full 3mm outer-thickness
  // margin on each side (where the edge notches live, so they never eat
  // into the compartment span) = 156/106.
  assertClose(bounds.width, 156, 0.5, 'plate width');
  assertClose(bounds.height, 106, 0.5, 'plate height');
});

test('T junction: the divider is one piece protruding by the outer edge\'s full thickness at both ends', () => {
  const t = createDefaultProject();
  t.grid = createGrid([80, 80], [100]); // 2 cols x 1 row: one interior vertical divider, no X crossing
  t.outerThicknessMm = 3;
  t.innerThicknessMm = 5;
  const runs = enumerateWallRuns(t.grid, t);
  assert(runs.length === 5, `expected 5 runs (4 outer sides + 1 divider), got ${runs.length}`);
  const divider = findRun(runs, 'v', (r) => r.c === 1);
  const piece = buildWallPanel(divider, t.grid, t, true);
  assert(isSimplePolygon(piece.outline), 'divider outline self-intersects');
  assert(piece.holes.length === 0, 'a T-junction stem itself has no mortise holes — it has the ordinary end comb');
  const { minX, maxX } = xExtent(piece.outline);
  assertClose(minX, -3, 1e-6, 'divider top-end protrusion should be the full outerThickness, not half — the mortise it fills is cut all the way through the outer edge');
  assertClose(maxX - 100, 3, 1e-6, 'divider bottom-end protrusion should be the full outerThickness, not half');
});

test('T junction: the through-wall stays one piece and gets a mortise hole sized to the divider\'s own thickness', () => {
  const t = createDefaultProject();
  t.grid = createGrid([80, 80], [100]);
  t.outerThicknessMm = 3;
  t.innerThicknessMm = 5;
  const runs = enumerateWallRuns(t.grid, t);
  const topRun = findRun(runs, 'h', (r) => r.r === 0);
  // 165, not the raw sum 160: xAt now adds half the divider's own 5mm
  // thickness on each side of the boundary it sits at (c=1), per the
  // corrected grid coordinate model (sx/sy are clear interior spans, wall
  // thickness is added on top, never just summed raw).
  assertClose(topRun.length, 165, 1e-9, 'the top run should span both columns as one piece, not split at the divider');
  const piece = buildWallPanel(topRun, t.grid, t, true);
  assert(isSimplePolygon(piece.outline), 'through-wall outline self-intersects');
  assert(piece.holes.length === 2, `expected 2 mortise holes (one per finger of the divider's default 50mm-tall end comb), got ${piece.holes.length}`);
  for (const hole of piece.holes) {
    assert(isSimplePolygon(hole), 'mortise hole should be a simple rectangle');
    const xs = hole.map((p) => p.x);
    const width = Math.max(...xs) - Math.min(...xs);
    assertClose(width, 5, 1e-9, 'mortise hole width should equal the divider\'s own (inner) thickness');
    const center = (Math.max(...xs) + Math.min(...xs)) / 2;
    assertClose(center, 82.5, 1e-9, 'mortise hole should be centered on the divider\'s crossing position (xAt(1) = 80 + 5/2)');
  }
});

test('X crossing: both dividers stay one piece each, with a half-lap notch and no holes', () => {
  const x = createDefaultProject();
  x.grid = createGrid([90, 130], [70, 100]); // 2x2: two interior dividers cross once
  x.outerThicknessMm = 3;
  x.innerThicknessMm = 6;
  const runs = enumerateWallRuns(x.grid, x);
  assert(runs.length === 6, `expected 6 runs (4 outer sides + 2 full-length dividers), got ${runs.length}`);
  const vDivider = findRun(runs, 'v', (r) => r.c === 1);
  const hDivider = findRun(runs, 'h', (r) => r.r === 1);
  // 176/226, not the raw sums 170/220 — same corrected grid coordinate
  // model as the T-junction test above, here with two interior boundaries
  // (both crossed dividers) each adding their own 6mm/2 contribution.
  assertClose(vDivider.length, 176, 1e-9, 'the vertical divider should span both rows as one piece');
  assertClose(hDivider.length, 226, 1e-9, 'the horizontal divider should span both columns as one piece');

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
  const runs = enumerateWallRuns(m2.grid, m2);
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
  const runs = enumerateWallRuns(t.grid, t);
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
  const runs = enumerateWallRuns(t.grid, t);
  const dividerRuns = runs.filter((r) => r.kind === 'v' && r.c === 1);
  assert(dividerRuns.length === 1, `expected exactly 1 remaining piece (the top cell), got ${dividerRuns.length}`);
  assertClose(dividerRuns[0].length, 50, 1e-9, 'the remaining piece should be just the top cell\'s span');
});

// X crossing notch depth: h = min(x1, x2, y1, y2), the shortest of the
// four local heights touching the crossing (the h-run's two local
// heights on either side, and the v-run's two local heights on either
// side). Both pieces always notch to exactly h/2 — the h-run (x pieces)
// from the box floor up, the v-run (y pieces) from h/2 up to its own top
// edge. This is symmetric (never "taller reaches down to shorter's full
// height") and explains the U shape when y1 != y2: the notch floor is
// h/2 on both sides, but the open top above it differs per side. See
// PanelBuilder's crossingNotchDepth() docstring for the derivation.
function xCrossingGrid(hHeight, vHeight) {
  const t = createDefaultProject();
  t.grid = createGrid([90, 130], [70, 100]);
  t.grid = setSegmentHeight(t.grid, 'h', 0, 1, hHeight);
  t.grid = setSegmentHeight(t.grid, 'h', 1, 1, hHeight);
  t.grid = setSegmentHeight(t.grid, 'v', 1, 0, vHeight);
  t.grid = setSegmentHeight(t.grid, 'v', 1, 1, vHeight);
  const runs = enumerateWallRuns(t.grid, t);
  const v = buildWallPanel(runs.find((r) => r.kind === 'v' && r.c === 1), t.grid, t, true);
  const h = buildWallPanel(runs.find((r) => r.kind === 'h' && r.r === 1), t.grid, t, true);
  return { v, h };
}

test('X crossing: both pieces notch to half of the shorter height, symmetric regardless of which is taller', () => {
  const { v, h } = xCrossingGrid(30, 50); // h shorter than v
  assert(isSimplePolygon(v.outline) && isSimplePolygon(h.outline), 'outlines self-intersect');
  assert(v.holes.length === 0 && h.holes.length === 0, 'a height-mismatched X crossing should never produce an enclosed hole, only edge notches');
  const depth = Math.min(30, 50) / 2; // 15

  // v (taller, 50) notches down to 15 (half of the shorter 30), not 25
  // (half of its own 50) and not 30 (h's full height).
  const vYs = v.outline.map((p) => p.y);
  assertClose(Math.max(...vYs), 50, 1e-9, 'v\'s own top should still be reached elsewhere along its length');
  assert(vYs.some((y) => Math.abs(y - depth) < 1e-9), 'v\'s notch should reach exactly half of the shorter height (15)');

  // h (shorter, 30) notches to the same 15 — half of its own height, which
  // here also happens to be the shorter of the two.
  const hYs = h.outline.map((p) => p.y);
  assert(hYs.some((y) => Math.abs(y - depth) < 1e-9), 'h\'s notch should be half of its own height (15)');
});

test('X crossing: roles reversed (v shorter than h) — same symmetric half-of-shorter rule applies', () => {
  const { v, h } = xCrossingGrid(50, 30); // v shorter than h
  assert(isSimplePolygon(v.outline) && isSimplePolygon(h.outline), 'outlines self-intersect');
  assert(v.holes.length === 0 && h.holes.length === 0);
  const depth = Math.min(50, 30) / 2; // 15
  const vYs = v.outline.map((p) => p.y);
  const hYs = h.outline.map((p) => p.y);
  assert(vYs.some((y) => Math.abs(y - depth) < 1e-9), 'v (now shorter) should notch to half of its own height (15)');
  assert(hYs.some((y) => Math.abs(y - depth) < 1e-9), 'h (now taller) should notch down to half of the shorter height (15), not stop at 30');
});

test('X crossing: equal (but both shortened) heights stay symmetric, each notching half of the shared height', () => {
  const { v, h } = xCrossingGrid(30, 30);
  assert(v.holes.length === 0 && h.holes.length === 0);
  assert(isSimplePolygon(v.outline) && isSimplePolygon(h.outline), 'outlines self-intersect');
  const vYs = v.outline.map((p) => p.y);
  const hYs = h.outline.map((p) => p.y);
  assert(vYs.some((y) => Math.abs(y - 15) < 1e-9) && hYs.some((y) => Math.abs(y - 15) < 1e-9), 'both should notch to exactly half of the shared 30mm height');
});

test('X crossing: the taller piece\'s deep notch stays simple (not self-intersecting) after burn correction', () => {
  const t = createDefaultProject();
  t.grid = createGrid([90, 130], [70, 100]);
  t.grid = setSegmentHeight(t.grid, 'h', 0, 1, 30);
  t.grid = setSegmentHeight(t.grid, 'h', 1, 1, 30);
  const pieces = computePieces(t);
  const v = pieces.find((p) => p.id === 'wall-v-1-0');
  assert(v.holes.length === 0, 'no enclosed holes expected for this feature anymore');
  assert(isSimplePolygon(v.outline), 'burn-corrected outline with a deep notch should stay simple');
});

test('X crossing coinciding exactly with a height step on the OTHER run: both pieces still use the true shorter height, not one arbitrary side of the step', () => {
  // Only the cell on ONE side of the crossing is shortened, so the
  // horizontal divider's own height step lands exactly on the same grid
  // point as the X crossing with the vertical divider. Reported by the
  // user reproducing this exact edit through the real editor.
  const t = createDefaultProject();
  t.grid = createGrid([90, 130], [70, 100]);
  t.grid = setSegmentHeight(t.grid, 'h', 1, 1, 20); // only the right cell of the horizontal divider
  const runs = enumerateWallRuns(t.grid, t);
  const hPiece = buildWallPanel(runs.find((r) => r.kind === 'h' && r.r === 1), t.grid, t, true);
  const vPiece = buildWallPanel(runs.find((r) => r.kind === 'v' && r.c === 1), t.grid, t, true);
  assert(isSimplePolygon(hPiece.outline), 'h outline self-intersects at the coincident step/crossing');
  assert(isSimplePolygon(vPiece.outline), 'v outline self-intersects at the coincident step/crossing');
  assert(vPiece.holes.length === 0);

  // The true local height of h right at the crossing is 20 (the shorter,
  // customized side) — not 50 (the unmodified side), regardless of which
  // side a naive "resolve at this exact boundary" lookup might pick. So
  // h = min(x1=50, x2=20, y1=50, y2=50) = 20, and v (uniformly 50) should
  // notch down to h/2 = 10, not to 20 and not to 40 (half of its own 50).
  const vYs = vPiece.outline.map((p) => p.y);
  assert(vYs.some((y) => Math.abs(y - 10) < 1e-6), 'v\'s notch should reach exactly h/2 = 10, using h\'s true local (shorter) height of 20');
});

// The user's own pseudo-code for this feature: h = min(x1, x2, y1, y2)
// across all four local heights touching the crossing; the x-run (h kind)
// gets a bottom notch from the floor up to h/2; the y-run (v kind) gets a
// notch from h/2 up to its own top edge. When the v-run's own two local
// heights differ (a height step on its OWN axis lands exactly on the
// crossing point), the result is a U shape: the notch floor is h/2 on
// both sides, but the open top above it differs per side, matching each
// side's own height. This is what the previous "taller piece reaches the
// shorter piece's full height" rule got wrong — it only ever compared the
// crossing's two *pieces*, never all four local heights, so a step on the
// piece's own axis barely notched the taller side instead of cutting it
// down to the true shared floor.
test('X crossing: an own-axis height step coinciding with the crossing produces a U-shaped notch, same floor on both sides', () => {
  const t = createDefaultProject();
  t.grid = createGrid([90, 130], [70, 100]);
  t.grid = setSegmentHeight(t.grid, 'v', 1, 0, 20); // top cell of the vertical divider
  t.grid = setSegmentHeight(t.grid, 'v', 1, 1, 90); // bottom cell, much taller
  const runs = enumerateWallRuns(t.grid, t);
  const vPiece = buildWallPanel(runs.find((r) => r.kind === 'v' && r.c === 1), t.grid, t, true);
  const hPiece = buildWallPanel(runs.find((r) => r.kind === 'h' && r.r === 1), t.grid, t, true);
  assert(isSimplePolygon(vPiece.outline) && isSimplePolygon(hPiece.outline), 'outlines self-intersect');
  assert(vPiece.holes.length === 0 && hPiece.holes.length === 0, 'no enclosed holes, only edge notches');

  // h (both cells default 50, untouched by v's step): h = min(50,50,20,90) = 20, depth = 10.
  const hYs = hPiece.outline.map((p) => p.y);
  assertClose(Math.max(...hYs), 50, 1e-9, 'h\'s own height should stay untouched elsewhere');
  assert(hYs.some((y) => Math.abs(y - 10) < 1e-6), 'h\'s notch floor should be h/2 = 10');

  // v: the notch floor is the SAME h/2 = 10 on both sides of the step —
  // not 80 on the taller side, which is what the old "subtract a fixed
  // depth from each side's own height" logic produced.
  const vYs = vPiece.outline.map((p) => p.y);
  assert(vYs.some((y) => Math.abs(y - 10) < 1e-6), 'v\'s notch floor should be h/2 = 10 on the shorter (20) side');
  assert(vYs.some((y) => Math.abs(y - 20) < 1e-6), 'v\'s free edge should still reach 20 on the shorter side, outside the notch');
  assert(vYs.some((y) => Math.abs(y - 90) < 1e-6), 'v\'s free edge should still reach 90 on the taller side, outside the notch');
  assert(!vYs.some((y) => Math.abs(y - 80) < 1e-6), 'v should not stop at 80 (90 minus a flat depth of 10 taken from its own height) — that was the old, wrong behavior');
});

// The user's own reframing of the finger-joint request: reason per
// PORTION of a wall run (the stretches between interior junctions), not
// across the run's whole length at once — max teeth, centered, within
// each portion — and never place a tooth on or straddling a junction
// itself, X or T alike.
test('bottomCombSegments leaves a plain flush gap at an interior T junction, with independently-tiled teeth on each side', () => {
  const t = createDefaultProject();
  t.grid = createGrid([80, 80], [100]); // T junction: divider at c=1 lands mid-span on the top run
  t.outerThicknessMm = 3;
  t.innerThicknessMm = 5;
  const runs = enumerateWallRuns(t.grid, t);
  const topRun = runs.find((r) => r.kind === 'h' && r.r === 0);
  assertClose(topRun.length, 165, 1e-9);
  const segs = bottomCombSegments(topRun, t.grid, t);

  const total = segs.reduce((s, seg) => s + seg.length, 0);
  assertClose(total, 165, 1e-6, 'segments must still cover the run\'s full length, gaplessly');

  // The T junction lands at u=82.5 (xAt(1) = 80 + divider's own 5mm/2) with
  // the divider's own (inner, 5mm) thickness.
  const exStart = 82.5 - 5 / 2;
  const exEnd = 82.5 + 5 / 2;
  for (const seg of segs) {
    if (seg.kind !== 'finger') continue;
    const overlapsJunction = seg.start < exEnd && seg.start + seg.length > exStart;
    assert(!overlapsJunction, `finger [${seg.start}, ${seg.start + seg.length}] should not straddle the T junction [${exStart}, ${exEnd}]`);
  }
  assert(segs.some((s) => s.kind === 'finger' && s.start + s.length <= exStart), 'expected at least one finger tiled on the left portion, before the junction');
  assert(segs.some((s) => s.kind === 'finger' && s.start >= exEnd), 'expected at least one finger tiled on the right portion, after the junction');
});

test('bottomCombSegments leaves a plain flush gap at an interior X crossing too, sized to the crossing piece\'s own thickness', () => {
  const x = createDefaultProject();
  x.grid = createGrid([90, 130], [70, 100]); // 2x2: two dividers cross once
  x.outerThicknessMm = 3;
  x.innerThicknessMm = 6;
  const runs = enumerateWallRuns(x.grid, x);
  const hDivider = runs.find((r) => r.kind === 'h' && r.r === 1);
  assertClose(hDivider.length, 226, 1e-9);
  const segs = bottomCombSegments(hDivider, x.grid, x);

  const total = segs.reduce((s, seg) => s + seg.length, 0);
  assertClose(total, 226, 1e-6, 'segments must still cover the run\'s full length, gaplessly');

  // The X crossing lands at u=93 (xAt(1) = 90 + vertical divider's own
  // 6mm/2), sized to its own (inner, 6mm) thickness.
  const exStart = 93 - 6 / 2;
  const exEnd = 93 + 6 / 2;
  for (const seg of segs) {
    if (seg.kind !== 'finger') continue;
    const overlapsJunction = seg.start < exEnd && seg.start + seg.length > exStart;
    assert(!overlapsJunction, `finger [${seg.start}, ${seg.start + seg.length}] should not straddle the X crossing [${exStart}, ${exEnd}]`);
  }
  assert(segs.some((s) => s.kind === 'finger' && s.start + s.length <= exStart), 'expected at least one finger tiled on the left portion, before the crossing');
  assert(segs.some((s) => s.kind === 'finger' && s.start >= exEnd), 'expected at least one finger tiled on the right portion, after the crossing');
});

test('an interior T junction (a stem meeting another interior divider) also protrudes by the mate\'s FULL thickness, not half — the rule is uniform, no outer/inner branching', () => {
  const project = createDefaultProject();
  project.grid = createGrid([80, 80], [50, 50]); // 2 cols x 2 rows
  project.outerThicknessMm = 3;
  project.innerThicknessMm = 5;
  // Remove the vertical divider's bottom half: its remaining (top) run now
  // ends mid-span on the horizontal divider — an interior T — instead of
  // on the outer edge.
  project.grid = toggleWall(project.grid, 'v', 1, 1);
  const runs = enumerateWallRuns(project.grid, project);
  const vDivider = runs.find((r) => r.kind === 'v' && r.c === 1 && r.rStart === 0 && r.rEnd === 0);
  assert(vDivider, 'expected the vertical divider\'s remaining top-half run');
  const piece = buildWallPanel(vDivider, project.grid, project, true);
  const { minX, maxX } = xExtent(piece.outline);
  assertClose(minX, -3, 1e-6, 'top end still mates with the outer edge: full 3mm outer thickness');
  assertClose(maxX - vDivider.length, 5, 1e-6, 'bottom end now mates with the interior horizontal divider: full 5mm inner thickness, not 2.5');
});

test('buildBasePlate notches span the mate\'s full outer thickness, and never cross into the compartment', () => {
  const project = createDefaultProject();
  project.grid = createGrid([150], [100]);
  project.outerThicknessMm = 3;
  const plate = buildBasePlate(project.grid, project);
  const topYs = plate.outline
    .filter((p) => p.x > 5 && p.x < 145 && p.y < 50) // interior of the top edge only, away from corners and the far (bottom) edge
    .map((p) => p.y);
  assert(topYs.some((y) => Math.abs(y - -3) < 1e-6), 'expected flush stretches at the plate\'s true outer edge, -3mm (a full outerThicknessMm out from the compartment boundary)');
  assert(topYs.some((y) => Math.abs(y - 0) < 1e-6), 'expected notches to recede back to exactly the compartment boundary, y=0');
  assert(topYs.every((y) => y <= 1e-6), `a notch must never cross into the compartment (y>0) — found: ${topYs.filter((y) => y > 1e-6).join(',')}`);
});

test('buildBasePlate end-to-end: the user\'s reported scenario — 2x2 grid of 50mm cells, 3mm outer walls, 2mm interior divider — a 50mm compartment measures 50mm on the bare plate, not 47', () => {
  const project = createDefaultProject();
  project.grid = createGrid([50, 50], [50, 50]);
  project.outerThicknessMm = 3;
  project.innerThicknessMm = 2;
  const plate = buildBasePlate(project.grid, project);

  // The plate's own physical footprint includes the outer margin on every
  // side (102 nominal compartment + 3mm margin each side = 108) — see the
  // single-cell test above for why.
  const bounds = pieceBounds(plate);
  assertClose(bounds.width, 108, 0.5, 'base plate\'s own physical footprint should be 108mm (102 + 3mm margin each side)');
  assertClose(bounds.height, 108, 0.5, 'base plate\'s own physical footprint should be 108mm (102 + 3mm margin each side)');

  // What actually matters — the compartment span the user measures
  // between a wall notch and the divider hole — must be the full 50mm,
  // not 50 minus a wall thickness. The divider hole sits at x:[50,52]
  // (xAt(1)=51, half the 2mm divider on each side); no outline point
  // should intrude past x=0 (the compartment's own left boundary) on its
  // way there.
  // The vertical divider's own finger holes (excluding the horizontal
  // divider's, which run the other axis) all start at x=50 — the true
  // compartment boundary of the first 50mm cell.
  const verticalDividerHoles = plate.holes.filter((h) => Math.min(...h.map((p) => p.x)) === Math.max(...h.map((p) => p.x)) - 2);
  assert(verticalDividerHoles.length > 0, 'expected at least one finger hole for the vertical divider');
  const holeXs = verticalDividerHoles.flatMap((h) => h.map((p) => p.x));
  assertClose(Math.min(...holeXs), 50, 1e-9, 'divider hole should start at x=50 — the true compartment boundary of the first 50mm cell');

  // The left edge's own notch (which the user measured from) must never
  // cross x=0 into the compartment — every outline point along the left
  // edge stays at x<=0.
  const leftEdgeYRange = [10, 90]; // away from the top/bottom corners
  const leftEdgePoints = plate.outline.filter((p) => p.y > leftEdgeYRange[0] && p.y < leftEdgeYRange[1] && p.x < 50);
  assert(leftEdgePoints.length > 0, 'expected some left-edge outline points in range');
  assert(leftEdgePoints.every((p) => p.x <= 1e-6), `left-edge notch must never cross x=0 into the compartment — found: ${leftEdgePoints.filter((p) => p.x > 1e-6).map((p) => p.x).join(',')}`);
});

run();
