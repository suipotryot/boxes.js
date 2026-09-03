// MortiseHole: a rectangular hole generated straight from a stem's own
// finger-tiled end comb (one hole per 'finger' segment), so a hole can
// never drift out of sync with the tenon meant to sit in it. Equivalence
// against buildWallPanel's own T-junction output was also verified
// extensively during migration; once the old pipeline was deleted at
// cutover, that comparison lost its oracle and was retired along with it.
import { test, assert, run } from './testHarness.js';
import { fingerEdgePath } from '../geometry/FingerJoint.js';
import { MortiseHole } from '../geometry/oo/MortiseHole.js';

test('polygon(): wound bottom-left -> bottom-right -> top-right -> top-left, matching Hole\'s own convention', () => {
  const hole = new MortiseHole({ xMm: 10, yMm: 20, widthMm: 5, heightMm: 8 });
  const poly = hole.polygon();
  assert(poly.length === 4);
  assert(poly[0].x === 10 && poly[0].y === 20, 'bottom-left first');
  assert(poly[1].x === 15 && poly[1].y === 20, 'bottom-right second');
  assert(poly[2].x === 15 && poly[2].y === 28, 'top-right third');
  assert(poly[3].x === 10 && poly[3].y === 28, 'top-left fourth');
});

test('manyFromFingerSegments (axis=\'y\', the T-junction case): one hole per finger segment only, centered on centerMm, width = stem thickness', () => {
  const fj = { fingerMm: 10, spaceMm: 10, marginMm: 5, playMm: 0 };
  const segs = fingerEdgePath(50, fj, true);
  const fingerCount = segs.filter((s) => s.kind === 'finger').length;
  const holes = MortiseHole.manyFromFingerSegments(segs, { centerMm: 100, thicknessMm: 3 });
  assert(holes.length === fingerCount, `expected exactly one hole per finger segment (${fingerCount}), got ${holes.length}`);
  for (const h of holes) {
    assert(h.xMm === 100 - 1.5 && h.widthMm === 3, 'each hole should be centered on centerMm with the stem\'s own thickness as width');
  }
});

test('manyFromFingerSegments (axis=\'x\', the base-plate divider-hole case): transposed — tiling along X, thickness band in Y, offsetMm shifts the tiling origin', () => {
  const fj = { fingerMm: 10, spaceMm: 10, marginMm: 5, playMm: 0 };
  const segs = fingerEdgePath(50, fj, true);
  const holes = MortiseHole.manyFromFingerSegments(segs, { axis: 'x', centerMm: 20, thicknessMm: 2, offsetMm: 100 });
  for (const h of holes) {
    assert(h.yMm === 20 - 1 && h.heightMm === 2, 'the thickness band should be centered on centerMm in Y');
    assert(h.xMm >= 100, 'the tiling origin should be shifted by offsetMm');
  }
});

run();
