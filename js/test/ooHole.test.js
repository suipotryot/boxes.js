// Hole (trou) — see js/geometry/oo/Hole.js's own header comment for the
// design. Ported from js/test/hole.test.js's pure shape/format tests; the
// integration tests against buildWallPanel/buildBasePlate/etc. stay on the
// old suite until the equivalence-test step (Edge/Panel/Box don't exist
// yet).
import { test, assert, assertClose, run } from './testHarness.js';
import { Cutout } from '../geometry/oo/Cutout.js';
import { Hole, DEFAULT_HOLE } from '../geometry/oo/Hole.js';

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

// --- polygon(): pure shape math ---

test('polygon: radius 0 gives exactly the 4 rectangle corners', () => {
  const hole = new Hole({ xMm: 10, yMm: 20, widthMm: 30, heightMm: 15, radiusMm: 0 });
  const poly = hole.polygon();
  assert(poly.length === 4, `expected 4 points, got ${poly.length}`);
  const xs = new Set(poly.map((p) => p.x));
  const ys = new Set(poly.map((p) => p.y));
  assert(xs.has(10) && xs.has(40), 'expected the rectangle\'s left/right x bounds among the points');
  assert(ys.has(20) && ys.has(35), 'expected the rectangle\'s bottom/top y bounds among the points');
  assert(isSimplePolygon(poly), 'a plain rectangle should be a simple polygon');
});

test('polygon: a rounded hole stays within its own nominal rectangle and every point sits on one of the 4 corner arcs or a straight edge', () => {
  const hole = new Hole({ xMm: 10, yMm: 20, widthMm: 30, heightMm: 20, radiusMm: 5 });
  const poly = hole.polygon();
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

test('polygon: a radius beyond its own geometric max is clamped defensively, stays a simple polygon', () => {
  const hole = new Hole({ xMm: 0, yMm: 0, widthMm: 20, heightMm: 10, radiusMm: 1000 });
  const poly = hole.polygon();
  assert(isSimplePolygon(poly), 'an over-large radius should clamp rather than self-intersect');
  for (const p of poly) {
    assert(p.x >= -1e-6 && p.x <= 20 + 1e-6 && p.y >= -1e-6 && p.y <= 10 + 1e-6, 'clamped hole should still stay within its nominal rectangle');
  }
});

test('maxRadiusMm: caps at half the SMALLER dimension (both ends are free, unlike a notch)', () => {
  assertClose(new Hole({ ...DEFAULT_HOLE, widthMm: 30, heightMm: 20 }).maxRadiusMm(), 10, 1e-9);
  assertClose(new Hole({ ...DEFAULT_HOLE, widthMm: 10, heightMm: 20 }).maxRadiusMm(), 5, 1e-9);
});

// --- Hole.listFor ---

test('Hole.listFor: returns Hole instances for the stored list, or an empty list when absent', () => {
  const stored = [{ xMm: 0, yMm: 0, widthMm: 5, heightMm: 5, radiusMm: 0 }];
  const list = Hole.listFor({ id1: stored }, 'id1');
  assert(list.length === 1 && list[0] instanceof Hole);
  assert(Hole.listFor({}, 'id1').length === 0);
  assert(Hole.listFor(undefined, 'id1').length === 0);
});

// --- Cutout.replaceAt / movedBy / resizedToward: mouse-drag editing helpers ---
// (shared by both a text-field editor and a pointer-drag commit, so both
// paths go through identical, tested logic)

test('Cutout.replaceAt: replaces only the hole at the given index, merging the patch, leaving siblings on the same piece untouched', () => {
  const a = new Hole({ xMm: 1, yMm: 1, widthMm: 5, heightMm: 5, radiusMm: 0 });
  const b = new Hole({ xMm: 20, yMm: 20, widthMm: 5, heightMm: 5, radiusMm: 0 });
  const next = Cutout.replaceAt([a, b], 1, { xMm: 30 });
  assert(next[0] === a, 'the untouched sibling should be the same object');
  assert(next[1] instanceof Hole && next[1].xMm === 30 && next[1].yMm === 20, 'the patched hole should merge, not replace, its fields');
});

test('Cutout.replaceAt: does not mutate the input list or its items', () => {
  const original = [new Hole({ xMm: 0, yMm: 0, widthMm: 5, heightMm: 5, radiusMm: 0 })];
  const before = original[0].xMm;
  Cutout.replaceAt(original, 0, { xMm: 99 });
  assert(original[0].xMm === before, 'the input list\'s items should be unchanged after the call');
});

test('movedBy: adds the delta to xMm/yMm, leaves widthMm/heightMm/radiusMm unchanged', () => {
  const hole = new Hole({ xMm: 10, yMm: 20, widthMm: 30, heightMm: 15, radiusMm: 3 });
  const moved = hole.movedBy(5, -2);
  assert(moved instanceof Hole);
  assertClose(moved.xMm, 15, 1e-9);
  assertClose(moved.yMm, 18, 1e-9);
  assert(moved.widthMm === hole.widthMm && moved.heightMm === hole.heightMm && moved.radiusMm === hole.radiusMm);
});

test('movedBy: applying the same delta twice from the same original hole gives the same result as applying it once (no accumulated drift)', () => {
  const original = new Hole({ xMm: 10, yMm: 20, widthMm: 30, heightMm: 15, radiusMm: 0 });
  const once = original.movedBy(7, 3);
  const againFromOriginal = original.movedBy(7, 3);
  assertClose(once.xMm, againFromOriginal.xMm, 1e-9, 'moving from the same original twice with the same delta must be idempotent');
  assertClose(once.yMm, againFromOriginal.yMm, 1e-9);
});

test('resizedToward: grows width/height toward the dragged point, anchor corner (xMm/yMm) never moves', () => {
  const hole = new Hole({ xMm: 10, yMm: 20, widthMm: 5, heightMm: 5, radiusMm: 0 });
  const resized = hole.resizedToward({ x: 40, y: 50 }, 1);
  assertClose(resized.widthMm, 30, 1e-9);
  assertClose(resized.heightMm, 30, 1e-9);
  assertClose(resized.xMm, 10, 1e-9);
  assertClose(resized.yMm, 20, 1e-9);
});

test('resizedToward: floors width/height independently at minSizeMm when dragged past the anchor corner', () => {
  const hole = new Hole({ xMm: 10, yMm: 20, widthMm: 5, heightMm: 5, radiusMm: 0 });
  const resized = hole.resizedToward({ x: 8, y: 60 }, 1);
  assertClose(resized.widthMm, 1, 1e-9, 'dragging past the anchor on x should floor at minSizeMm, not go negative');
  assertClose(resized.heightMm, 40, 1e-9, 'the other axis should resize normally');
});

// --- toTextLine / fromTextLine ---

test('toTextLine/fromTextLine round-trip a well-formed hole', () => {
  const hole = new Hole({ xMm: 10, yMm: 20.5, widthMm: 30, heightMm: 15, radiusMm: 2 });
  const line = hole.toTextLine();
  assert(line === '10, 20.5, 30, 15, 2', `unexpected format: "${line}"`);
  const parsed = Hole.fromTextLine(line);
  assert(parsed instanceof Hole);
  assertClose(parsed.xMm, hole.xMm, 1e-9);
  assertClose(parsed.yMm, hole.yMm, 1e-9);
  assertClose(parsed.widthMm, hole.widthMm, 1e-9);
  assertClose(parsed.heightMm, hole.heightMm, 1e-9);
  assertClose(parsed.radiusMm, hole.radiusMm, 1e-9);
});

test('Hole.fromTextLine rejects malformed input rather than guessing', () => {
  assert(Hole.fromTextLine('10, 20, 30, 15') === null, 'only 4 values should be rejected');
  assert(Hole.fromTextLine('10, 20, 30, 15, 2, 5') === null, '6 values should be rejected');
  assert(Hole.fromTextLine('10, vingt, 30, 15, 2') === null, 'a non-numeric token should be rejected');
  assert(Hole.fromTextLine('10, , 30, 15, 2') === null, 'an empty token between commas should be rejected, not silently become 0');
});

test('DEFAULT_HOLE is a well-formed, valid-shaped starting point', () => {
  const hole = new Hole(DEFAULT_HOLE);
  assert(hole.widthMm > 0 && hole.heightMm > 0 && hole.radiusMm === 0);
});

run();
