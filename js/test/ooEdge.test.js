// Edge: the shared boundary-merge algorithm behind SmoothEdge/FingerEdge —
// tested here in isolation via a minimal concrete subclass, independent of
// what "value" actually means for any real edge role.
import { test, assert, assertClose, run } from './testHarness.js';
import { Edge } from '../geometry/oo/Edge.js';

// Two zones: 0 (u<5) and 10 (u>=5).
class TwoZoneEdge extends Edge {
  ownBoundaries() {
    return [5];
  }
  baseValueAt(u) {
    return u < 5 ? 0 : 10;
  }
}

test('points(): with no fragments, a constant-value edge produces exactly 2 points at that value', () => {
  class FlatEdge extends Edge {
    baseValueAt() { return 7; }
  }
  const pts = new FlatEdge(20).points();
  assert(pts.length === 2);
  assertClose(pts[0].u, 0, 1e-9); assertClose(pts[0].y, 7, 1e-9);
  assertClose(pts[1].u, 20, 1e-9); assertClose(pts[1].y, 7, 1e-9);
});

test('points(): ownBoundaries() splits the trace at each declared u, one flat pair per zone', () => {
  const pts = new TwoZoneEdge(10).points();
  assert(pts.length === 4, `expected 4 points (2 zones x 2), got ${pts.length}`);
  assertClose(pts[0].u, 0, 1e-9); assertClose(pts[0].y, 0, 1e-9);
  assertClose(pts[1].u, 5, 1e-9); assertClose(pts[1].y, 0, 1e-9);
  assertClose(pts[2].u, 5, 1e-9); assertClose(pts[2].y, 10, 1e-9);
  assertClose(pts[3].u, 10, 1e-9); assertClose(pts[3].y, 10, 1e-9);
});

test('points(): a flat-override fragment ({uStart,uEnd,depth}) replaces the base value only within its own range', () => {
  const edge = new TwoZoneEdge(10, [{ uStart: 2, uEnd: 4, depth: 99 }]);
  const pts = edge.points();
  // boundaries: 0,2,4,5,10 -> 4 intervals; a shared boundary u legitimately
  // appears twice with two different y values (a vertical "jump" in the
  // outline), so check the fragment's own interval specifically rather
  // than filtering by u range alone.
  assert(pts.length === 8, `expected 8 points (4 intervals x 2), got ${pts.length}`);
  assert(pts.some((p) => p.u === 2 && p.y === 99) && pts.some((p) => p.u === 4 && p.y === 99), 'the override interval [2,4] should be at y=99');
  assert(pts.some((p) => p.u === 2 && p.y === 0), 'the point just before the override should still show the base value (a vertical jump at u=2)');
  assert(pts.some((p) => p.u === 4 && p.y === 0), 'the point just after the override should return to the base value (a vertical jump at u=4)');
  const before = pts.find((p) => p.u === 0);
  assert(before.y === 0, 'points before the fragment should keep the base value');
  const after = pts.find((p) => p.u === 10);
  assert(after.y === 10, 'points after the fragment should keep the base value');
});

test('points(): a polyline fragment ({uStart,uEnd,points}) is spliced in verbatim, base value never consulted there', () => {
  const polyline = [{ u: 2, y: -1 }, { u: 3, y: -5 }, { u: 4, y: -1 }];
  const edge = new TwoZoneEdge(10, [{ uStart: 2, uEnd: 4, points: polyline }]);
  const pts = edge.points();
  const spliced = pts.filter((p) => p.u >= 2 && p.u <= 4 && p.y < 0);
  assert(spliced.length === 3, `expected the 3 polyline points to appear verbatim, got ${spliced.length} matching`);
  for (const p of polyline) assert(pts.some((q) => q.u === p.u && q.y === p.y));
});

test('points(): two overlap-free fragments both apply, each within its own range', () => {
  const edge = new TwoZoneEdge(10, [
    { uStart: 1, uEnd: 2, depth: -1 },
    { uStart: 7, uEnd: 8, depth: -2 },
  ]);
  const pts = edge.points();
  assert(pts.some((p) => p.u === 1 && p.y === -1));
  assert(pts.some((p) => p.u === 2 && p.y === -1));
  assert(pts.some((p) => p.u === 7 && p.y === -2));
  assert(pts.some((p) => p.u === 8 && p.y === -2));
});

run();
