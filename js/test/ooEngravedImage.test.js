import { test, assertClose, run } from './testHarness.js';
import { readSvgSizeMm } from '../geometry/oo/EngravedImage.js';

test('readSvgSizeMm: should read width and height given in millimetres', () => {
  const size = readSvgSizeMm('<svg xmlns="http://www.w3.org/2000/svg" width="40mm" height="25mm"></svg>');
  assertClose(size.widthMm, 40);
  assertClose(size.heightMm, 25);
});

run();
