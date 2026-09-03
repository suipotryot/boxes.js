// Divider (Cloison): a Panel in the fullest sense — no fields of its own.
// See the plan's own "Cloison extends Planche" analysis for why this
// holds "à la lettre" (the user's own words), unlike Box/Drawer where
// inheritance would have been misleading.
import { test, assert, run } from './testHarness.js';
import { Panel } from '../geometry/oo/Panel.js';
import { Divider } from '../geometry/oo/Divider.js';
import { SmoothEdge } from '../geometry/oo/SmoothEdge.js';
import { FingerEdge } from '../geometry/oo/FingerEdge.js';

function sampleDivider() {
  const fj = { fingerMm: 20, spaceMm: 20, marginMm: 5 };
  const bottomEdge = new FingerEdge({ lengthMm: 80, fingerJoint: fj, startWithFinger: true, mateThicknessMm: 3, baselineMm: 0, signMm: -1 });
  const rightEdge = new FingerEdge({ lengthMm: 35, fingerJoint: fj, startWithFinger: true, mateThicknessMm: 2, baselineMm: 80, signMm: 1 });
  const topEdge = new SmoothEdge({ lengthMm: 80, heightProfile: [{ uStart: 0, uEnd: 80, height: 35 }] });
  const leftEdge = new FingerEdge({ lengthMm: 35, fingerJoint: fj, startWithFinger: true, mateThicknessMm: 2, baselineMm: 0, signMm: -1 });
  return new Divider({ id: 'divider-v-1', kind: 'wall', thicknessGroup: 'inner', thicknessMm: 2, bottomEdge, rightEdge, topEdge, leftEdge });
}

test('a Divider is a Panel — same outline()/toPiece() behavior, no extra fields', () => {
  const divider = sampleDivider();
  assert(divider instanceof Panel);
  const piece = divider.toPiece();
  assert(piece.id === 'divider-v-1' && piece.kind === 'wall' && piece.thicknessGroup === 'inner');
  assert(Array.isArray(piece.outline) && piece.outline.length > 0);
});

test('Object.keys(divider) is exactly the Panel fields — Divider adds nothing of its own', () => {
  const divider = sampleDivider();
  const keys = Object.keys(divider).sort();
  assert(JSON.stringify(keys) === JSON.stringify(['bottomEdge', 'holes', 'id', 'kind', 'leftEdge', 'rightEdge', 'thicknessGroup', 'thicknessMm', 'topEdge']));
});

run();
