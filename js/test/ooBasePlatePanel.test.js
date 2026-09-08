// BasePlatePanel: a FlatPanel in the fullest sense — no fields of its own,
// just id/kind fixed to 'base-plate'/'basePlate' regardless of what's
// passed in (there's only ever one base plate per box).
import { test, assert, run } from './testHarness.js';
import { FlatPanel } from '../geometry/oo/FlatPanel.js';
import { BasePlatePanel } from '../geometry/oo/BasePlatePanel.js';
import { SmoothEdge } from '../geometry/oo/SmoothEdge.js';

function sampleBasePlatePanel() {
  const flatEdge = (lengthMm) => new SmoothEdge({ lengthMm, heightProfile: [{ uStart: 0, uEnd: lengthMm, height: 0 }] });
  return new BasePlatePanel({
    thicknessMm: 3,
    bottomEdge: flatEdge(100), rightEdge: flatEdge(80), topEdge: flatEdge(100), leftEdge: flatEdge(80),
    widthMm: 100, depthMm: 80, marginMm: 3, protrude: false,
    openSides: { top: true, right: true, bottom: true, left: true },
  });
}

test('BasePlatePanel(): is a FlatPanel, with id/kind always fixed to base-plate/basePlate', () => {
  const basePlate = sampleBasePlatePanel();
  assert(basePlate instanceof FlatPanel);
  assert(basePlate.id === 'base-plate');
  assert(basePlate.kind === 'basePlate');
  assert(basePlate.thicknessGroup === 'outer');
});

run();
