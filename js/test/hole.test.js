// User-placed holes (trous) — a rectangle, optionally corner-rounded,
// fully enclosed inside a piece's own local (x,y) space, always at least
// MIN_EDGE_MARGIN_MM from that piece's own nominal (untoothed) rectangle.
// Unlike a grip notch (GripNotch.js), a hole is never anchored to an
// edge — both x and y are entirely free — so it applies uniformly to any
// flat piece (wall, base plate, lid, drawer equivalents), not just walls.
import { test, assert, assertClose, run } from './testHarness.js';
import { createGrid } from '../model/Grid.js';
import { createDefaultProject } from '../state/Project.js';
import { DEFAULT_HOLE, maxRadiusMm, holeListFor, holePolygon, formatHoleLine, parseHoleLine, setHoleAt, moveHoleBy, resizeHoleToward } from '../geometry/Hole.js';
import { validateHoleInRect, validateWallHole } from '../geometry/HoleValidation.js';
import { buildBasePlate } from '../geometry/BasePlateBuilder.js';
import { buildWallPanel, wallPieceId } from '../geometry/PanelBuilder.js';
import { buildLid } from '../geometry/LidBuilder.js';
import { buildDrawerBox, DRAWER_PREFIX } from '../geometry/DrawerBuilder.js';
import { computePieces } from '../geometry/PieceFactory.js';
import { burnCorrect } from '../geometry/BurnCorrection.js';
import { enumerateWallRuns } from '../model/GridQuery.js';

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
function holeWidth(hole) {
  const xs = hole.map((p) => p.x);
  return Math.max(...xs) - Math.min(...xs);
}
function holeHeight(hole) {
  const ys = hole.map((p) => p.y);
  return Math.max(...ys) - Math.min(...ys);
}

// --- holePolygon: pure shape math ---

test('holePolygon: radius 0 gives exactly the 4 rectangle corners', () => {
  const hole = { xMm: 10, yMm: 20, widthMm: 30, heightMm: 15, radiusMm: 0 };
  const poly = holePolygon(hole);
  assert(poly.length === 4, `expected 4 points, got ${poly.length}`);
  const xs = new Set(poly.map((p) => p.x));
  const ys = new Set(poly.map((p) => p.y));
  assert(xs.has(10) && xs.has(40), 'expected the rectangle\'s left/right x bounds among the points');
  assert(ys.has(20) && ys.has(35), 'expected the rectangle\'s bottom/top y bounds among the points');
  assert(isSimplePolygon(poly), 'a plain rectangle should be a simple polygon');
});

test('holePolygon: a rounded hole stays within its own nominal rectangle and every point sits on one of the 4 corner arcs or a straight edge', () => {
  const hole = { xMm: 10, yMm: 20, widthMm: 30, heightMm: 20, radiusMm: 5 };
  const poly = holePolygon(hole);
  assert(isSimplePolygon(poly), 'a rounded-rectangle hole should be a simple polygon');

  const corners = [
    { u: hole.xMm + hole.radiusMm, v: hole.yMm + hole.radiusMm },
    { u: hole.xMm + hole.widthMm - hole.radiusMm, v: hole.yMm + hole.radiusMm },
    { u: hole.xMm + hole.widthMm - hole.radiusMm, v: hole.yMm + hole.heightMm - hole.radiusMm },
    { u: hole.xMm + hole.radiusMm, v: hole.yMm + hole.heightMm - hole.radiusMm },
  ];
  for (const p of poly) {
    assert(p.x >= hole.xMm - 1e-6 && p.x <= hole.xMm + hole.widthMm + 1e-6, `x=${p.x} escaped the nominal rectangle`);
    assert(p.y >= hole.yMm - 1e-6 && p.y <= hole.yMm + hole.heightMm + 1e-6, `y=${p.y} escaped the nominal rectangle`);
    const onArc = corners.some((c) => Math.abs(Math.hypot(p.x - c.u, p.y - c.v) - hole.radiusMm) < 1e-6);
    const onStraightEdge = Math.abs(p.x - hole.xMm) < 1e-6 || Math.abs(p.x - (hole.xMm + hole.widthMm)) < 1e-6
      || Math.abs(p.y - hole.yMm) < 1e-6 || Math.abs(p.y - (hole.yMm + hole.heightMm)) < 1e-6;
    assert(onArc || onStraightEdge, `point (${p.x},${p.y}) is on neither a corner arc nor a straight edge`);
  }
});

test('holePolygon: a radius beyond its own geometric max is clamped defensively, stays a simple polygon', () => {
  const hole = { xMm: 0, yMm: 0, widthMm: 20, heightMm: 10, radiusMm: 1000 };
  const poly = holePolygon(hole);
  assert(isSimplePolygon(poly), 'an over-large radius should clamp rather than self-intersect');
  for (const p of poly) {
    assert(p.x >= -1e-6 && p.x <= 20 + 1e-6 && p.y >= -1e-6 && p.y <= 10 + 1e-6, 'clamped hole should still stay within its nominal rectangle');
  }
});

test('maxRadiusMm: caps at half the SMALLER dimension (both ends are free, unlike a grip notch)', () => {
  assertClose(maxRadiusMm({ widthMm: 30, heightMm: 20 }), 10, 1e-9);
  assertClose(maxRadiusMm({ widthMm: 10, heightMm: 20 }), 5, 1e-9);
});

test('winding: a burn-corrected hole shrinks (not grows) — same regression check every other hole type in this codebase uses', () => {
  const project = createDefaultProject();
  project.grid = createGrid([150], [100]);
  project.pieceHoles = { 'base-plate': [{ xMm: 20, yMm: 20, widthMm: 40, heightMm: 30, radiusMm: 0 }] };
  const plate = burnCorrect(buildBasePlate(project.grid, project), project.burnMm);
  const userHole = plate.holes.find((h) => holeWidth(h) < 40 + 1e-6 && holeWidth(h) > 39);
  assert(userHole, 'expected to find the user hole (burn-shrunk from 40x30) among the base plate\'s holes');
  assert(holeWidth(userHole) < 40, 'burn correction should shrink the hole\'s width, not grow it');
  assert(holeHeight(userHole) < 30, 'burn correction should shrink the hole\'s height, not grow it');
  assert(isSimplePolygon(userHole), 'burn-corrected hole should stay simple');
});

// --- holeListFor ---

test('holeListFor: returns the stored list, or an empty list when absent', () => {
  const list = [{ xMm: 0, yMm: 0, widthMm: 5, heightMm: 5, radiusMm: 0 }];
  assert(holeListFor({ id1: list }, 'id1') === list);
  assert(holeListFor({}, 'id1').length === 0);
  assert(holeListFor(undefined, 'id1').length === 0);
});

// --- setHoleAt / moveHoleBy / resizeHoleToward: mouse-drag editing helpers ---
// (used by both HoleEditor.js's text field and HoleDragOverlay.js's
// pointer-drag commit, so both paths go through identical, tested logic)

test('setHoleAt: replaces only the hole at the given index, merging the patch, leaving siblings on the same piece untouched', () => {
  const a = { xMm: 1, yMm: 1, widthMm: 5, heightMm: 5, radiusMm: 0 };
  const b = { xMm: 20, yMm: 20, widthMm: 5, heightMm: 5, radiusMm: 0 };
  const pieceHoles = { pieceA: [a, b] };
  const next = setHoleAt(pieceHoles, 'pieceA', 1, { xMm: 30 });
  assert(next.pieceA[0] === a, 'the untouched sibling should be the same object');
  assert(next.pieceA[1].xMm === 30 && next.pieceA[1].yMm === 20, 'the patched hole should merge, not replace, its fields');
});

test('setHoleAt: leaves other pieces\' hole lists untouched', () => {
  const listB = [{ xMm: 1, yMm: 1, widthMm: 5, heightMm: 5, radiusMm: 0 }];
  const pieceHoles = { pieceA: [{ xMm: 0, yMm: 0, widthMm: 5, heightMm: 5, radiusMm: 0 }], pieceB: listB };
  const next = setHoleAt(pieceHoles, 'pieceA', 0, { xMm: 9 });
  assert(next.pieceB === listB, 'a different piece\'s hole list should be the same reference, untouched');
});

test('setHoleAt: does not mutate the input pieceHoles map or its arrays (undo/redo relies on this)', () => {
  const original = { pieceA: [{ xMm: 0, yMm: 0, widthMm: 5, heightMm: 5, radiusMm: 0 }] };
  const snapshot = JSON.parse(JSON.stringify(original));
  setHoleAt(original, 'pieceA', 0, { xMm: 99 });
  assert(JSON.stringify(original) === JSON.stringify(snapshot), 'the input object should be unchanged after the call');
});

test('moveHoleBy: adds the delta to xMm/yMm, leaves widthMm/heightMm/radiusMm unchanged', () => {
  const hole = { xMm: 10, yMm: 20, widthMm: 30, heightMm: 15, radiusMm: 3 };
  const moved = moveHoleBy(hole, 5, -2);
  assertClose(moved.xMm, 15, 1e-9);
  assertClose(moved.yMm, 18, 1e-9);
  assert(moved.widthMm === hole.widthMm && moved.heightMm === hole.heightMm && moved.radiusMm === hole.radiusMm);
});

test('moveHoleBy: applying the same delta twice from the same original hole gives the same result as applying it once (no accumulated drift)', () => {
  const original = { xMm: 10, yMm: 20, widthMm: 30, heightMm: 15, radiusMm: 0 };
  const once = moveHoleBy(original, 7, 3);
  const againFromOriginal = moveHoleBy(original, 7, 3);
  assert(JSON.stringify(once) === JSON.stringify(againFromOriginal), 'moving from the same original twice with the same delta must be idempotent');
});

test('resizeHoleToward: grows width/height toward the dragged point, anchor corner (xMm/yMm) never moves', () => {
  const hole = { xMm: 10, yMm: 20, widthMm: 5, heightMm: 5, radiusMm: 0 };
  const resized = resizeHoleToward(hole, { x: 40, y: 50 }, 1);
  assertClose(resized.widthMm, 30, 1e-9);
  assertClose(resized.heightMm, 30, 1e-9);
  assertClose(resized.xMm, 10, 1e-9);
  assertClose(resized.yMm, 20, 1e-9);
});

test('resizeHoleToward: floors width/height independently at minSizeMm when dragged past the anchor corner', () => {
  const hole = { xMm: 10, yMm: 20, widthMm: 5, heightMm: 5, radiusMm: 0 };
  const resized = resizeHoleToward(hole, { x: 8, y: 60 }, 1);
  assertClose(resized.widthMm, 1, 1e-9, 'dragging past the anchor on x should floor at minSizeMm, not go negative');
  assertClose(resized.heightMm, 40, 1e-9, 'the other axis should resize normally');
});

// --- formatHoleLine / parseHoleLine ---

test('formatHoleLine/parseHoleLine round-trip a well-formed hole', () => {
  const hole = { xMm: 10, yMm: 20.5, widthMm: 30, heightMm: 15, radiusMm: 2 };
  const line = formatHoleLine(hole);
  assert(line === '10, 20.5, 30, 15, 2', `unexpected format: "${line}"`);
  const parsed = parseHoleLine(line);
  assertClose(parsed.xMm, hole.xMm, 1e-9);
  assertClose(parsed.yMm, hole.yMm, 1e-9);
  assertClose(parsed.widthMm, hole.widthMm, 1e-9);
  assertClose(parsed.heightMm, hole.heightMm, 1e-9);
  assertClose(parsed.radiusMm, hole.radiusMm, 1e-9);
});

test('parseHoleLine rejects malformed input rather than guessing', () => {
  assert(parseHoleLine('10, 20, 30, 15') === null, 'only 4 values should be rejected');
  assert(parseHoleLine('10, 20, 30, 15, 2, 5') === null, '6 values should be rejected');
  assert(parseHoleLine('10, vingt, 30, 15, 2') === null, 'a non-numeric token should be rejected');
  assert(parseHoleLine('10, , 30, 15, 2') === null, 'an empty token between commas should be rejected, not silently become 0');
});

test('DEFAULT_HOLE is a well-formed, valid-shaped starting point', () => {
  assert(DEFAULT_HOLE.widthMm > 0 && DEFAULT_HOLE.heightMm > 0 && DEFAULT_HOLE.radiusMm === 0);
});

// --- validateHoleInRect ---

test('validateHoleInRect: rejects non-positive dimensions', () => {
  assert(!validateHoleInRect(100, 100, { xMm: 10, yMm: 10, widthMm: 0, heightMm: 10, radiusMm: 0 }).ok, 'zero width should be rejected');
  assert(!validateHoleInRect(100, 100, { xMm: 10, yMm: 10, widthMm: 10, heightMm: -5, radiusMm: 0 }).ok, 'negative height should be rejected');
});

test('validateHoleInRect: rejects a radius beyond its own geometric max', () => {
  const result = validateHoleInRect(100, 100, { xMm: 10, yMm: 10, widthMm: 20, heightMm: 10, radiusMm: 8 });
  assert(!result.ok, 'a radius beyond min(width,height)/2 (=5 here) should be rejected');
});

test('validateHoleInRect: rejects each of the 4 edge-margin violations (2mm minimum), accepts a well-formed hole', () => {
  const rectW = 100, rectH = 60;
  assert(!validateHoleInRect(rectW, rectH, { xMm: 1, yMm: 10, widthMm: 20, heightMm: 10, radiusMm: 0 }).ok, 'too close to the left edge should be rejected');
  assert(!validateHoleInRect(rectW, rectH, { xMm: 10, yMm: 1, widthMm: 20, heightMm: 10, radiusMm: 0 }).ok, 'too close to the bottom edge should be rejected');
  assert(!validateHoleInRect(rectW, rectH, { xMm: 79.5, yMm: 10, widthMm: 20, heightMm: 10, radiusMm: 0 }).ok, 'too close to the right edge should be rejected');
  assert(!validateHoleInRect(rectW, rectH, { xMm: 10, yMm: 49.5, widthMm: 20, heightMm: 10, radiusMm: 0 }).ok, 'too close to the top edge should be rejected');

  const ok = validateHoleInRect(rectW, rectH, { xMm: 10, yMm: 10, widthMm: 20, heightMm: 10, radiusMm: 2 });
  assert(ok.ok, `expected a well-formed hole to validate, got problems: ${ok.problems.join('; ')}`);
});

test('validateHoleInRect: rejects two sibling holes on the same piece that overlap, accepts disjoint ones', () => {
  const a = { xMm: 10, yMm: 10, widthMm: 20, heightMm: 20, radiusMm: 0 };
  const overlappingSibling = { xMm: 25, yMm: 15, widthMm: 20, heightMm: 20, radiusMm: 0 }; // [25,45)x[15,35) overlaps [10,30)x[10,30)
  const overlapResult = validateHoleInRect(100, 100, a, [overlappingSibling]);
  assert(!overlapResult.ok, 'overlapping sibling holes should be rejected');
  assert(overlapResult.problems.some((p) => p.includes('chevauche un autre trou')));

  const disjointSibling = { xMm: 40, yMm: 10, widthMm: 20, heightMm: 20, radiusMm: 0 }; // [40,60) does not overlap [10,30)
  const disjointResult = validateHoleInRect(100, 100, a, [disjointSibling]);
  assert(disjointResult.ok, `expected disjoint sibling holes to validate, got: ${disjointResult.problems.join('; ')}`);
});

// --- validateWallHole ---

function baseProject() {
  const project = createDefaultProject();
  project.grid = createGrid([150], [100]); // single cell, no interior dividers
  project.outerThicknessMm = 3;
  project.outerHeightMm = 50;
  return project;
}

test('validateWallHole: accepts a well-formed hole on an ordinary outer wall, using the run\'s own length/height as the rect', () => {
  const project = baseProject();
  const run = enumerateWallRuns(project.grid, project).find((r) => r.kind === 'h' && r.r === 0);
  const ok = validateWallHole(run, project.grid, project, { xMm: 20, yMm: 10, widthMm: 30, heightMm: 15, radiusMm: 0 });
  assert(ok.ok, `expected a well-formed wall hole to validate, got problems: ${ok.problems.join('; ')}`);
});

test('validateWallHole: rejects a hole that would poke past the wall\'s own local height', () => {
  const project = baseProject(); // outerHeightMm = 50
  const run = enumerateWallRuns(project.grid, project).find((r) => r.kind === 'h' && r.r === 0);
  const tooTall = validateWallHole(run, project.grid, project, { xMm: 20, yMm: 10, widthMm: 30, heightMm: 45, radiusMm: 0 });
  assert(!tooTall.ok, 'a hole reaching past the wall\'s own local height (50mm) minus the 2mm margin should be rejected');
});

// --- integration: wiring into the real builders ---

test('a hole on an ordinary outer wall panel adds one closed subpath to piece.holes, outline unchanged, contour stays simple after burn correction', () => {
  const project = baseProject();
  const run = enumerateWallRuns(project.grid, project).find((r) => r.kind === 'h' && r.r === 0);
  const pieceId = wallPieceId(run);
  const before = buildWallPanel(run, project.grid, project, true);
  assert(before.holes.length === 0, 'sanity check: no holes yet');

  project.pieceHoles = { [pieceId]: [{ xMm: 20, yMm: 10, widthMm: 30, heightMm: 15, radiusMm: 3 }] };
  const after = buildWallPanel(run, project.grid, project, true);
  assert(after.holes.length === 1, 'expected exactly one user hole added');
  assert(JSON.stringify(after.outline) === JSON.stringify(before.outline), 'the outline itself should be unaffected by a user hole');

  const corrected = burnCorrect(after, project.burnMm);
  assert(isSimplePolygon(corrected.outline), 'burn-corrected outline should stay simple');
  assert(isSimplePolygon(corrected.holes[0]), 'burn-corrected user hole should stay simple');
});

test('a hole on the base plate and a hole on the lid both cut, contours stay simple', () => {
  const project = baseProject();
  project.lid = { enabled: true, insertHeightMm: 50 }; // flush with the perimeter height
  project.pieceHoles = {
    'base-plate': [{ xMm: 20, yMm: 20, widthMm: 30, heightMm: 20, radiusMm: 0 }],
    lid: [{ xMm: 30, yMm: 30, widthMm: 25, heightMm: 15, radiusMm: 4 }],
  };
  const plate = burnCorrect(buildBasePlate(project.grid, project), project.burnMm);
  const lid = burnCorrect(buildLid(project.grid, project), project.burnMm);
  assert(plate.holes.length === 1, 'expected the base plate\'s user hole');
  assert(lid.holes.length === 1, 'expected the lid\'s user hole');
  assert(isSimplePolygon(plate.outline) && isSimplePolygon(plate.holes[0]));
  assert(isSimplePolygon(lid.outline) && isSimplePolygon(lid.holes[0]));
});

test('a hole on a drawer wall and on the drawer\'s own base plate, via the DRAWER_PREFIX remap', () => {
  const project = baseProject();
  project.drawer = { enabled: true, playMm: 1, thicknessMm: 3, openSide: 'right' };

  const drawerWallId = `${DRAWER_PREFIX}wall-h-0-0`;
  const drawerBaseId = `${DRAWER_PREFIX}base-plate`;
  project.pieceHoles = {
    [drawerWallId]: [{ xMm: 20, yMm: 10, widthMm: 20, heightMm: 10, radiusMm: 0 }],
    [drawerBaseId]: [{ xMm: 15, yMm: 15, widthMm: 20, heightMm: 20, radiusMm: 0 }],
  };
  const pieces = buildDrawerBox(project.grid, project);
  const wall = pieces.find((p) => p.id === drawerWallId);
  const base = pieces.find((p) => p.id === drawerBaseId);
  assert(wall.holes.length === 1, 'expected the drawer wall\'s own user hole');
  assert(base.holes.length === 1, 'expected the drawer base plate\'s own user hole');
  assert(isSimplePolygon(wall.outline) && isSimplePolygon(base.outline));
});

test('no pieceHoles entry (or an empty list) leaves every piece exactly as before', () => {
  const project = baseProject();
  const before = computePieces(project);
  project.pieceHoles = { 'base-plate': [] };
  const after = computePieces(project);
  assert(before.length === after.length);
  for (let i = 0; i < before.length; i++) {
    assert(JSON.stringify(before[i].outline) === JSON.stringify(after[i].outline), `piece ${before[i].id} outline changed despite an empty hole list`);
    assert(JSON.stringify(before[i].holes) === JSON.stringify(after[i].holes), `piece ${before[i].id} holes changed despite an empty hole list`);
  }
});

run();
