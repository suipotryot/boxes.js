import { test, assert, assertClose, run } from './testHarness.js';
import { readSvgSizeMm } from '../geometry/oo/EngravedImage.js';

test('readSvgSizeMm: should read width and height given in millimetres', () => {
  const size = readSvgSizeMm('<svg xmlns="http://www.w3.org/2000/svg" width="40mm" height="25mm"></svg>');
  assertClose(size.widthMm, 40);
  assertClose(size.heightMm, 25);
});

test('readSvgSizeMm: should throw when the text is not an SVG', () => {
  let error = null;
  try {
    readSvgSizeMm('not an svg');
  } catch (e) {
    error = e;
  }
  assert(error !== null && /svg/i.test(error.message), 'expected an explicit error mentioning svg');
});

run();
