// Panel: assembles 4 Edge instances into one closed contour, and flattens
// via toPiece() into the exact {id,kind,thicknessGroup,thicknessMm,
// outline,holes} shape existing downstream code (BurnCorrection, the UI,
// export) already expects — the contract this whole refactor promised not
// to change. Equivalence against the old buildWallPanel was verified
// extensively during migration (see js/test/ooEquivalence.test.js's own
// history); once the old pipeline was deleted at cutover, that comparison
// lost its oracle and was retired along with it.
import { test, assert, run } from './testHarness.js';
import { Panel } from '../geometry/oo/Panel.js';
import { SmoothEdge } from '../geometry/oo/SmoothEdge.js';
import { FingerEdge } from '../geometry/oo/FingerEdge.js';

test('toPiece(): produces the same {id,kind,thicknessGroup,thicknessMm,outline,holes} shape existing downstream code expects', () => {
  const bottomEdge = new FingerEdge({ lengthMm: 100, fingerJoint: { fingerMm: 20, spaceMm: 20, marginMm: 5 }, startWithFinger: true, mateThicknessMm: 3, baselineMm: 0, signMm: -1 });
  const rightEdge = new FingerEdge({ lengthMm: 40, fingerJoint: { fingerMm: 20, spaceMm: 20, marginMm: 5 }, startWithFinger: true, mateThicknessMm: 3, extendToTips: true, baselineMm: 100, signMm: 1 });
  const topEdge = new SmoothEdge({ lengthMm: 100, heightProfile: [{ uStart: 0, uEnd: 100, height: 40 }] });
  const leftEdge = new FingerEdge({ lengthMm: 40, fingerJoint: { fingerMm: 20, spaceMm: 20, marginMm: 5 }, startWithFinger: true, mateThicknessMm: 3, extendToTips: true, baselineMm: 0, signMm: -1 });
  const panel = new Panel({ id: 'wall-h-0-0', kind: 'wall', thicknessGroup: 'outer', thicknessMm: 3, bottomEdge, rightEdge, topEdge, leftEdge });

  const piece = panel.toPiece();
  assert(piece.id === 'wall-h-0-0');
  assert(piece.kind === 'wall');
  assert(piece.thicknessGroup === 'outer');
  assert(piece.thicknessMm === 3);
  assert(Array.isArray(piece.outline) && piece.outline.length > 0);
  assert(Array.isArray(piece.holes) && piece.holes.length === 0);
});

run();
