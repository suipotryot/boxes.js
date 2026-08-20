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
});

test('fingerEdgePath keeps teeth at their configured width regardless of edge length — never stretched to fit exactly', () => {
  const fingerWidth = (segs) => segs.find((s) => s.kind === 'finger').length;
  assertClose(fingerWidth(fingerEdgePath(95, fj, true)), 10, 1e-6, 'finger width at 95mm should stay the configured 10mm');
  assertClose(fingerWidth(fingerEdgePath(400, fj, true)), 10, 1e-6, 'finger width at 400mm should stay the configured 10mm, not be stretched');
});

test('fingerEdgePath maximizes tooth count for the edge\'s own length — no fixed count, longer edges get more teeth', () => {
  const countFingers = (segs) => segs.filter((s) => s.kind === 'finger').length;
  const short = countFingers(fingerEdgePath(40, fj, true));
  const long = countFingers(fingerEdgePath(400, fj, true));
  assert(short > 0, 'expected at least one tooth to fit in 40mm');
  assert(long > short, `expected more teeth on a 400mm edge than a 40mm edge, got ${long} vs ${short}`);
});

test('fingerEdgePath centers any leftover slack evenly on both sides when the teeth don\'t exactly fill the usable span', () => {
  const segs = fingerEdgePath(95, fj, true); // usable=85 isn't a multiple of the 20mm cycle
  assertClose(segs[0].length, segs[segs.length - 1].length, 1e-6, 'leading and trailing flush should match — centered');
  assert(segs[0].length > fj.marginMm, 'the centering flush should exceed marginMm here, since marginMm is only a minimum');
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
