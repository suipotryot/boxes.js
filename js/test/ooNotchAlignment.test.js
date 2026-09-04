// centerNotches, distributeNotches — the 2 alignment buttons in
// GripNotchEditor.js. Unlike Hole (free x/y), a Notch only has ONE
// meaningful axis (offsetMm, along its edge) — its depth is pinned to the
// edge, never a position to align. Both delegate to the same
// centerOnAxis/distributeOnAxis used by HoleAlignment.js (see
// CutoutAlignment.js) — see ooHoleAlignment.test.js for the shared
// algorithm's own exhaustive coverage; these tests just check the
// offsetMm/widthMm bindings are wired correctly.
import { test, assert, assertClose, run } from './testHarness.js';
import { Notch } from '../geometry/oo/Notch.js';
import { centerNotches, distributeNotches } from '../geometry/oo/NotchAlignment.js';

function notch(offsetMm, widthMm) {
  return new Notch({ offsetMm, widthMm, depthMm: 5, radiusMm: 0 });
}

test('centerNotches: a single notch centers exactly within the available run length', () => {
  const [result] = centerNotches([notch(5, 20)], 100);
  assertClose(result.offsetMm, (100 - 20) / 2, 1e-9);
  assertClose(result.widthMm, 20, 1e-9, 'width unchanged');
});

test('centerNotches: each notch centers on its OWN width independently — original relative spacing is NOT preserved', () => {
  const notches = [notch(0, 10), notch(70, 10)];
  const [a, b] = centerNotches(notches, 100);
  assertClose(a.offsetMm, 45, 1e-9, 'first notch centers on its own');
  assertClose(b.offsetMm, 45, 1e-9, 'second notch centers on its own — collapses onto the first, spacing not kept');
});

test('centerNotches: empty list stays empty', () => {
  assert(centerNotches([], 100).length === 0, 'no notches to center');
});

test('distributeNotches: with 3 notches, the extremes stay untouched and the middle gets equal edge gaps', () => {
  const notches = [notch(0, 10), notch(40, 10), notch(90, 10)];
  const result = distributeNotches(notches);
  assertClose(result[0].offsetMm, 0, 1e-9, 'first untouched');
  assertClose(result[2].offsetMm, 90, 1e-9, 'last untouched');
  assertClose(result[1].offsetMm, 10 + 35, 1e-9, 'middle placed with equal edge gaps');
});

test('distributeNotches: preserves original list order (only positions move)', () => {
  const notches = [notch(90, 10), notch(40, 10), notch(0, 10)];
  const result = distributeNotches(notches);
  assertClose(result[0].offsetMm, 90, 1e-9, 'still the "last" notch, still untouched, still first in the list');
  assertClose(result[2].offsetMm, 0, 1e-9, 'still the "first" notch, still untouched, still last in the list');
  assertClose(result[1].offsetMm, 10 + 35, 1e-9, 'middle notch repositioned regardless of list order');
});

test('distributeNotches: fewer than 3 notches is a no-op', () => {
  assert(distributeNotches([]).length === 0, 'empty stays empty');
  const one = [notch(5, 10)];
  assertClose(distributeNotches(one)[0].offsetMm, 5, 1e-9, 'single notch untouched');
  const two = [notch(0, 10), notch(50, 10)];
  const result = distributeNotches(two);
  assertClose(result[0].offsetMm, 0, 1e-9, 'first of two untouched');
  assertClose(result[1].offsetMm, 50, 1e-9, 'second of two untouched (nothing "in the middle")');
});

run();
