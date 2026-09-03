// SmoothEdge: a straight/stepped un-toothed edge, following a height
// profile, with Notch fragments soldered in via the shared Edge.points().
import { test, assert, assertClose, run } from './testHarness.js';
import { SmoothEdge } from '../geometry/oo/SmoothEdge.js';
import { Notch } from '../geometry/oo/Notch.js';

test('a constant-height profile (one span) produces a flat 2-point trace', () => {
  const edge = new SmoothEdge({ lengthMm: 100, heightProfile: [{ uStart: 0, uEnd: 100, height: 40 }] });
  const pts = edge.points();
  assert(pts.length === 2);
  assertClose(pts[0].y, 40, 1e-9);
  assertClose(pts[1].y, 40, 1e-9);
});

test('a stepped height profile produces one flat pair per span, at each span\'s own height', () => {
  const edge = new SmoothEdge({
    lengthMm: 100,
    heightProfile: [{ uStart: 0, uEnd: 60, height: 40 }, { uStart: 60, uEnd: 100, height: 30 }],
  });
  const pts = edge.points();
  const below60 = pts.filter((p) => p.u < 60);
  const above60 = pts.filter((p) => p.u > 60);
  assert(below60.every((p) => p.y === 40), 'the first span should be at height 40');
  assert(above60.every((p) => p.y === 30), 'the second span should be at height 30');
});

test('baseValueAt at an exact span boundary resolves to the SHORTER touching span (matches the pre-existing heightAt convention)', () => {
  const edge = new SmoothEdge({
    lengthMm: 100,
    heightProfile: [{ uStart: 0, uEnd: 50, height: 40 }, { uStart: 50, uEnd: 100, height: 25 }],
  });
  assertClose(edge.baseValueAt(50), 25, 1e-9, 'the shorter (25mm) span should win exactly at the boundary');
});

test('a square (radius 0) Notch fragment cuts a flat floor into an otherwise-constant edge', () => {
  const notch = new Notch({ widthMm: 30, depthMm: 10, offsetMm: 20, radiusMm: 0 });
  const edge = new SmoothEdge({
    lengthMm: 100,
    heightProfile: [{ uStart: 0, uEnd: 100, height: 50 }],
    fragments: [notch.toEdgeFragment(50)],
  });
  const pts = edge.points();
  const floorPoints = pts.filter((p) => p.u >= 20 - 1e-6 && p.u <= 50 + 1e-6 && Math.abs(p.y - 40) < 1e-6);
  assert(floorPoints.length === 2, `expected exactly 2 points at the notch floor (y=40), got ${floorPoints.length}`);
  const untouched = pts.filter((p) => p.u < 20 || p.u > 50);
  assert(untouched.every((p) => p.y === 50), 'points outside the notch should keep the full height');
});

test('a Notch anchored across a height step uses the height AT ITS OWN position, not the edge\'s overall shape', () => {
  // The notch sits entirely within the second (lower) span — its own
  // local reference height must be 25, not 40 (the first span).
  const notch = new Notch({ widthMm: 10, depthMm: 5, offsetMm: 60, radiusMm: 0 });
  const edge = new SmoothEdge({
    lengthMm: 100,
    heightProfile: [{ uStart: 0, uEnd: 50, height: 40 }, { uStart: 50, uEnd: 100, height: 25 }],
    fragments: [notch.toEdgeFragment(25)],
  });
  const pts = edge.points();
  const floorPoints = pts.filter((p) => Math.abs(p.y - 20) < 1e-6); // 25 - 5
  assert(floorPoints.length === 2, 'expected the notch floor at 25-5=20, derived from its own local height');
});

run();
