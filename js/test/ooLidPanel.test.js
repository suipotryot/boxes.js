// LidPanel: a FlatPanel in the fullest sense — no fields of its own, just
// id/kind fixed to 'lid'/'lid' regardless of what's passed in (there's
// only ever one lid per box).
import { test, assert, run } from './testHarness.js';
import { FlatPanel } from '../geometry/oo/FlatPanel.js';
import { LidPanel } from '../geometry/oo/LidPanel.js';
import { SmoothEdge } from '../geometry/oo/SmoothEdge.js';

function sampleLidPanel() {
  const flatEdge = (lengthMm) => new SmoothEdge({ lengthMm, heightProfile: [{ uStart: 0, uEnd: lengthMm, height: 0 }] });
  return new LidPanel({
    thicknessMm: 3,
    bottomEdge: flatEdge(100), rightEdge: flatEdge(80), topEdge: flatEdge(100), leftEdge: flatEdge(80),
    widthMm: 100, depthMm: 80, marginMm: 3, protrude: true,
    openSides: { top: false, right: false, bottom: false, left: false },
  });
}

test('LidPanel(): is a FlatPanel, with id/kind always fixed to lid/lid', () => {
  const lid = sampleLidPanel();
  assert(lid instanceof FlatPanel);
  assert(lid.id === 'lid');
  assert(lid.kind === 'lid');
  assert(lid.thicknessGroup === 'outer');
});

run();
