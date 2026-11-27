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

test('readSvgSizeMm: should convert pixel dimensions at 96 dpi', () => {
  const size = readSvgSizeMm('<svg xmlns="http://www.w3.org/2000/svg" width="96px" height="48"></svg>');
  assertClose(size.widthMm, 25.4);
  assertClose(size.heightMm, 12.7);
});

test('readSvgSizeMm: should fall back on the viewBox when width and height are missing', () => {
  const size = readSvgSizeMm('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 48"></svg>');
  assertClose(size.widthMm, 25.4);
  assertClose(size.heightMm, 12.7);
});

test('readSvgSizeMm: should throw an explicit error when the SVG has no readable size', () => {
  let error = null;
  try {
    readSvgSizeMm('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
  } catch (e) {
    error = e;
  }
  assert(error !== null && /size/i.test(error.message), 'expected an explicit error mentioning the size');
});

run();
