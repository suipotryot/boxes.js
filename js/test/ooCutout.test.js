// Cutout: the shared base behind Notch/Hole — arc math, number-line
// parsing, and the immutable-patch helpers both subclasses reuse.
import { test, assert, assertClose, run } from './testHarness.js';
import { Cutout, arcPoints } from '../geometry/oo/Cutout.js';

// A minimal concrete subclass, just for exercising the base class's own
// shared behavior (withChanges/replaceAt) without pulling in Notch/Hole's
// own domain fields.
class Square extends Cutout {
  constructor({ sizeMm, radiusMm }) {
    super(radiusMm);
    this.sizeMm = sizeMm;
  }
  maxRadiusMm() {
    return this.sizeMm / 2;
  }
}

// --- arcPoints ---

test('arcPoints: sweeps exactly 90 degrees, every point at the given radius from center', () => {
  const pts = arcPoints(10, 20, 5, 180);
  assertClose(Math.hypot(pts[0].x - 10, pts[0].y - 20), 5, 1e-9);
  assertClose(Math.hypot(pts[pts.length - 1].x - 10, pts[pts.length - 1].y - 20), 5, 1e-9);
  assertClose(pts[0].x, 5, 1e-9, 'start at 180deg should be directly left of center');
  assertClose(pts[0].y, 20, 1e-9);
  assertClose(pts[pts.length - 1].x, 10, 1e-9, 'end at 270deg should be directly below center');
  assertClose(pts[pts.length - 1].y, 15, 1e-9);
});

test('arcPoints: segment count controls point density (segments+1 points)', () => {
  assert(arcPoints(0, 0, 5, 0, 4).length === 5);
  assert(arcPoints(0, 0, 5, 0, 8).length === 9);
});

// --- Cutout.parseNumbers ---

test('Cutout.parseNumbers: accepts exactly `count` well-formed comma-separated numbers', () => {
  const nums = Cutout.parseNumbers(' 20.5 ,8,0.0, 10 ', 4);
  assert(nums !== null);
  assertClose(nums[0], 20.5, 1e-9);
  assertClose(nums[1], 8, 1e-9);
  assertClose(nums[2], 0, 1e-9);
  assertClose(nums[3], 10, 1e-9);
});

test('Cutout.parseNumbers: rejects the wrong count, empty tokens, and non-numeric tokens', () => {
  assert(Cutout.parseNumbers('20, 8, 0', 4) === null, 'too few values should be rejected');
  assert(Cutout.parseNumbers('20, 8, 0, 10, 5', 4) === null, 'too many values should be rejected');
  assert(Cutout.parseNumbers('20, huit, 0, 10', 4) === null, 'a non-numeric token should be rejected');
  assert(Cutout.parseNumbers('20, , 0, 10', 4) === null, 'an empty token between commas should be rejected, not silently become 0');
});

// --- Cutout#clampedRadiusMm ---

test('Cutout#clampedRadiusMm: clamps a stored radius into [0, maxRadiusMm()]', () => {
  assertClose(new Square({ sizeMm: 20, radiusMm: 1000 }).clampedRadiusMm(), 10, 1e-9);
  assertClose(new Square({ sizeMm: 20, radiusMm: -5 }).clampedRadiusMm(), 0, 1e-9);
  assertClose(new Square({ sizeMm: 20, radiusMm: 4 }).clampedRadiusMm(), 4, 1e-9);
});

// --- Cutout#withChanges / Cutout.replaceAt ---

test('Cutout#withChanges: returns a new instance of the same subclass, merging the patch', () => {
  const original = new Square({ sizeMm: 20, radiusMm: 2 });
  const changed = original.withChanges({ sizeMm: 30 });
  assert(changed instanceof Square, 'withChanges should produce an instance of the same subclass, not a plain object');
  assert(changed !== original, 'withChanges should not mutate the original');
  assertClose(changed.sizeMm, 30, 1e-9);
  assertClose(changed.radiusMm, 2, 1e-9, 'fields not in the patch should carry over unchanged');
  assertClose(original.sizeMm, 20, 1e-9, 'the original must be untouched');
});

test('Cutout.replaceAt: replaces only the item at the given index, leaving siblings the same object', () => {
  const a = new Square({ sizeMm: 10, radiusMm: 0 });
  const b = new Square({ sizeMm: 20, radiusMm: 0 });
  const next = Cutout.replaceAt([a, b], 1, { sizeMm: 99 });
  assert(next[0] === a, 'the untouched sibling should be the same object');
  assert(next[1] instanceof Square && next[1].sizeMm === 99, 'the patched item should merge, not replace, its fields');
});

run();
