import { test, assert, run } from './testHarness.js';
import { FlatPanel } from '../geometry/oo/FlatPanel.js';
import { HorizontalPanel } from '../geometry/oo/HorizontalPanel.js';
import { SmoothEdge } from '../geometry/oo/SmoothEdge.js';

function sampleHorizontalPanel(id) {
  const flatEdge = (lengthMm) => new SmoothEdge({ lengthMm, heightProfile: [{ uStart: 0, uEnd: lengthMm, height: 0 }] });
  return new HorizontalPanel({
    id,
    thicknessMm: 3,
    bottomEdge: flatEdge(100), rightEdge: flatEdge(80), topEdge: flatEdge(100), leftEdge: flatEdge(80),
    widthMm: 100, depthMm: 80, marginMm: 3, protrude: true,
    openSides: { top: false, right: false, bottom: false, left: false },
  });
}

test('HorizontalPanel() should be an outer FlatPanel of kind horizontalPanel, keeping the id it is given', () => {
  const panel = sampleHorizontalPanel('horizontal-panel-2');
  assert(panel instanceof FlatPanel);
  assert(panel.id === 'horizontal-panel-2', `got ${panel.id}`);
  assert(panel.kind === 'horizontalPanel', `got ${panel.kind}`);
  assert(panel.thicknessGroup === 'outer', `got ${panel.thicknessGroup}`);
});

run();
