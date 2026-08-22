// pieceLabel is pure (no DOM) and safe to test directly in Node —
// pieceLabelElement/pieceToStandaloneSvg/renderSvgPage all touch
// document.createElementNS and are verified live via Playwright instead,
// same split this project already keeps for every DOM-touching function.
import { test, assert, run } from './testHarness.js';
import { pieceLabel } from '../geometry/SvgPath.js';

test('pieceLabel: outer wall gets a "Paroi" label with its grid coordinates', () => {
  const piece = { kind: 'wall', thicknessGroup: 'outer', id: 'wall-h-3-2' };
  assert(pieceLabel(piece) === 'Paroi H3,2', `got "${pieceLabel(piece)}"`);
});

test('pieceLabel: interior divider gets a "Cloison" label with its grid coordinates', () => {
  const piece = { kind: 'wall', thicknessGroup: 'inner', id: 'wall-v-1-0' };
  assert(pieceLabel(piece) === 'Cloison V1,0', `got "${pieceLabel(piece)}"`);
});

test('pieceLabel: the base plate is never labeled', () => {
  const piece = { kind: 'basePlate', thicknessGroup: 'outer', id: 'base-plate' };
  assert(pieceLabel(piece) === null);
});

test('pieceLabel: the lid is never labeled', () => {
  const piece = { kind: 'lid', thicknessGroup: 'outer', id: 'lid' };
  assert(pieceLabel(piece) === null);
});

run();
