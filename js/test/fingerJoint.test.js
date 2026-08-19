import { test, assert, assertClose, run } from './testHarness.js';
import { fingerEdgePath, withMinMargin } from '../geometry/FingerJoint.js';

const fj = { fingerMm: 10, spaceMm: 10, marginMm: 5, playMm: 0 };

test('fingerEdgePath segments sum exactly to length', () => {
  const segs = fingerEdgePath(123.4, fj, true);
  const total = segs.reduce((s, seg) => s + seg.length, 0);
  assertClose(total, 123.4, 1e-6, 'segment lengths');
});

test('fingerEdgePath starts and ends with a flush margin', () => {
  const segs = fingerEdgePath(100, fj, true);
  assert(segs[0].kind === 'flush', 'first segment should be flush');
  assert(segs[segs.length - 1].kind === 'flush', 'last segment should be flush');
  assertClose(segs[0].length, 5, 1e-6, 'leading margin');
});

test('startWithFinger controls the first tooth after the margin', () => {
  const withFinger = fingerEdgePath(100, fj, true);
  const withSpace = fingerEdgePath(100, fj, false);
  assert(withFinger[1].kind === 'finger', 'expected finger first');
  assert(withSpace[1].kind === 'space', 'expected space first');
});

test('two mating edges (opposite startWithFinger) tile identically in position', () => {
  const a = fingerEdgePath(100, fj, true);
  const b = fingerEdgePath(100, fj, false);
  assert(a.length === b.length, 'same segment count');
  for (let i = 0; i < a.length; i++) {
    assertClose(a[i].start, b[i].start, 1e-6, `segment ${i} start`);
    assertClose(a[i].length, b[i].length, 1e-6, `segment ${i} length`);
    assert(a[i].kind !== b[i].kind || a[i].kind === 'flush', `segment ${i} should be complementary`);
  }
});

test('too-short length degrades to a single flush segment', () => {
  const segs = fingerEdgePath(4, fj, true);
  assert(segs.length === 1 && segs[0].kind === 'flush', 'expected single flush segment');
  assertClose(segs[0].length, 4, 1e-6);
});

test('play shrinks fingers without changing the total length', () => {
  const withPlay = fingerEdgePath(100, { ...fj, playMm: 1 }, true);
  const noPlay = fingerEdgePath(100, fj, true);
  const totalWithPlay = withPlay.reduce((s, seg) => s + seg.length, 0);
  assertClose(totalWithPlay, 100, 1e-6, 'total length with play');
  const firstFingerPlay = withPlay.find((s) => s.kind === 'finger').length;
  const firstFingerNoPlay = noPlay.find((s) => s.kind === 'finger').length;
  assert(firstFingerPlay < firstFingerNoPlay, 'finger should shrink with play');
});

test('withMinMargin raises marginMm without mutating the input', () => {
  const bigger = withMinMargin(fj, 8);
  assertClose(bigger.marginMm, 8, 1e-6);
  assertClose(fj.marginMm, 5, 1e-6, 'original untouched');
  const unchanged = withMinMargin(fj, 2);
  assertClose(unchanged.marginMm, 5, 1e-6, 'should not lower an existing larger margin');
});

run();
