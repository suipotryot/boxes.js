// centerHolesOnX/Y, distributeHolesOnX/Y — the 4 group alignment buttons in
// HoleEditor.js. Pure list-in/list-out functions, order-preserving (so a
// button click never reshuffles which UI row is which hole).
import { test, assert, assertClose, run } from './testHarness.js';
import { Hole } from '../geometry/oo/Hole.js';
import { MIN_EDGE_MARGIN_MM } from '../geometry/oo/HoleValidation.js';
import {
  centerHolesOnX, centerHolesOnY, distributeHolesOnX, distributeHolesOnY,
} from '../geometry/oo/HoleAlignment.js';

function hole(xMm, yMm, widthMm, heightMm) {
  return new Hole({ xMm, yMm, widthMm, heightMm, radiusMm: 0 });
}

test('centerHolesOnX: a single hole centers exactly within the available width', () => {
  const [result] = centerHolesOnX([hole(5, 10, 20, 10)], 100);
  // usable = 100 - 2*margin; hole should sit centered in [margin, 100-margin]
  const usable = 100 - 2 * MIN_EDGE_MARGIN_MM;
  assertClose(result.xMm, MIN_EDGE_MARGIN_MM + (usable - 20) / 2, 1e-9, 'x');
  assertClose(result.yMm, 10, 1e-9, 'y unchanged');
  assertClose(result.widthMm, 20, 1e-9, 'width unchanged');
});

test('centerHolesOnX: each hole centers on its OWN axis independently — original relative spacing is NOT preserved', () => {
  // Same width, far apart: both must land on the exact same x once each is
  // centered on its own, since (100-10)/2 is the same value for both.
  const holes = [hole(0, 0, 10, 5), hole(70, 0, 10, 5)];
  const [a, b] = centerHolesOnX(holes, 100);
  assertClose(a.xMm, 45, 1e-9, 'first hole centers on its own');
  assertClose(b.xMm, 45, 1e-9, 'second hole centers on its own — collapses onto the first, spacing not kept');
});

test('centerHolesOnX: holes of different widths each center on their own width, independently of one another', () => {
  const holes = [hole(0, 0, 20, 5), hole(60, 0, 40, 5)];
  const [a, b] = centerHolesOnX(holes, 100);
  assertClose(a.xMm, 40, 1e-9, '(100-20)/2');
  assertClose(b.xMm, 30, 1e-9, '(100-40)/2, unrelated to the first hole');
});

test('centerHolesOnX: empty list stays empty', () => {
  assert(centerHolesOnX([], 100).length === 0, 'no holes to center');
});

test('centerHolesOnY: behaves like centerHolesOnX but on the height axis', () => {
  const [result] = centerHolesOnY([hole(10, 5, 20, 10)], 60);
  assertClose(result.yMm, (60 - 10) / 2, 1e-9, 'y');
  assertClose(result.xMm, 10, 1e-9, 'x unchanged');
});

test('centerHolesOnY: each hole centers independently, not as a group', () => {
  const holes = [hole(0, 0, 5, 10), hole(0, 45, 5, 10)];
  const [a, b] = centerHolesOnY(holes, 60);
  assertClose(a.yMm, 25, 1e-9, '(60-10)/2');
  assertClose(b.yMm, 25, 1e-9, 'same height -> lands at the exact same y as the first');
});

test('centerHolesOnY: accepts a per-hole available-height getter, for a wall whose local height varies (T-junction)', () => {
  const holes = [hole(0, 0, 5, 10), hole(0, 0, 5, 20)];
  const heightMmFor = (h) => (h.heightMm === 10 ? 60 : 100);
  const [a, b] = centerHolesOnY(holes, heightMmFor);
  assertClose(a.yMm, (60 - 10) / 2, 1e-9, 'first hole centers against its own local height');
  assertClose(b.yMm, (100 - 20) / 2, 1e-9, 'second hole centers against its own (different) local height');
});

test('distributeHolesOnX: with 3 holes, the extremes stay untouched and the middle gets equal edge gaps', () => {
  // first: [0,10], last: [90,100] (both widthMm=10); middle: widthMm=10 too.
  const holes = [hole(0, 0, 10, 10), hole(40, 0, 10, 10), hole(90, 0, 10, 10)];
  const result = distributeHolesOnX(holes);
  assertClose(result[0].xMm, 0, 1e-9, 'first untouched');
  assertClose(result[2].xMm, 90, 1e-9, 'last untouched');
  // inner span = 90 - 10 = 80; minus middle width 10 = 70; / 2 gaps = 35 each
  assertClose(result[1].xMm, 10 + 35, 1e-9, 'middle placed with equal edge gaps');
  assertClose(result[1].xMm - (result[0].xMm + result[0].widthMm), result[2].xMm - (result[1].xMm + result[1].widthMm), 1e-9, 'both gaps equal');
});

test('distributeHolesOnX: preserves original list order (only positions move)', () => {
  // Deliberately out-of-order input (last hole listed first) — output must
  // keep the SAME index-to-hole identity, only xMm changes.
  const holes = [hole(90, 0, 10, 10), hole(40, 0, 10, 10), hole(0, 0, 10, 10)];
  const result = distributeHolesOnX(holes);
  assertClose(result[0].xMm, 90, 1e-9, 'still the "last" hole, still untouched, still first in the list');
  assertClose(result[2].xMm, 0, 1e-9, 'still the "first" hole, still untouched, still last in the list');
  assertClose(result[1].xMm, 10 + 35, 1e-9, 'middle hole repositioned regardless of list order');
});

test('distributeHolesOnX: unequal-size middle holes still get equal edge gaps', () => {
  const holes = [hole(0, 0, 10, 10), hole(20, 0, 5, 10), hole(50, 0, 20, 10), hole(120, 0, 10, 10)];
  const result = distributeHolesOnX(holes);
  assertClose(result[0].xMm, 0, 1e-9, 'first untouched');
  assertClose(result[3].xMm, 120, 1e-9, 'last untouched');
  const gap1 = result[1].xMm - (result[0].xMm + result[0].widthMm);
  const gap2 = result[2].xMm - (result[1].xMm + result[1].widthMm);
  const gap3 = result[3].xMm - (result[2].xMm + result[2].widthMm);
  assertClose(gap1, gap2, 1e-9, 'gap 1 == gap 2');
  assertClose(gap2, gap3, 1e-9, 'gap 2 == gap 3');
});

test('distributeHolesOnX: fewer than 3 holes is a no-op', () => {
  const zero = distributeHolesOnX([]);
  assert(zero.length === 0, 'empty stays empty');

  const one = [hole(5, 0, 10, 10)];
  assertClose(distributeHolesOnX(one)[0].xMm, 5, 1e-9, 'single hole untouched');

  const two = [hole(0, 0, 10, 10), hole(50, 0, 10, 10)];
  const result = distributeHolesOnX(two);
  assertClose(result[0].xMm, 0, 1e-9, 'first of two untouched');
  assertClose(result[1].xMm, 50, 1e-9, 'second of two untouched (nothing "in the middle")');
});

test('distributeHolesOnY: with 3 holes, the extremes stay untouched and the middle gets equal edge gaps', () => {
  const holes = [hole(0, 0, 10, 10), hole(0, 40, 10, 10), hole(0, 90, 10, 10)];
  const result = distributeHolesOnY(holes);
  assertClose(result[0].yMm, 0, 1e-9, 'first untouched');
  assertClose(result[2].yMm, 90, 1e-9, 'last untouched');
  assertClose(result[1].yMm, 10 + 35, 1e-9, 'middle placed with equal edge gaps');
});

run();
