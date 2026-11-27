import { test, assert, assertClose, run } from './testHarness.js';
import { EngravedImage, readSvgSizeMm } from '../geometry/oo/EngravedImage.js';

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

test('centeredIn: should place the image at the centre of the area with the size of the SVG', () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="40mm" height="20mm"></svg>';
  const image = EngravedImage.centeredIn(svg, 100, 60);
  assertClose(image.xMm, 30);
  assertClose(image.yMm, 20);
  assertClose(image.widthMm, 40);
  assertClose(image.heightMm, 20);
  assert(image.svg === svg, 'expected the SVG text to be kept');
});

test('centeredIn: should still centre an image larger than the area', () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="120mm" height="20mm"></svg>';
  const image = EngravedImage.centeredIn(svg, 100, 60);
  assertClose(image.xMm, -10);
  assertClose(image.yMm, 20);
});

test('listFor: should build the images stored for a piece, and none for an unknown piece', () => {
  const stored = { xMm: 1, yMm: 2, widthMm: 3, heightMm: 4, svg: '<svg/>' };
  const pieceImages = { lid: [stored] };
  const images = EngravedImage.listFor(pieceImages, 'lid');
  assert(images.length === 1 && images[0] instanceof EngravedImage, 'expected one EngravedImage');
  assertClose(images[0].widthMm, 3);
  assert(EngravedImage.listFor(pieceImages, 'base-plate').length === 0, 'expected no image for another piece');
  assert(EngravedImage.listFor(undefined, 'lid').length === 0, 'expected no image without any stored map');
});

test('toTextLine: should list x, y, width and height', () => {
  const image = new EngravedImage({ xMm: 10, yMm: 20, widthMm: 30, heightMm: 40, svg: '<svg/>' });
  assert(image.toTextLine() === '10, 20, 30, 40', `got ${image.toTextLine()}`);
});

test('placementFromTextLine: should read x, y, width and height, and null when the text is unreadable', () => {
  const placement = EngravedImage.placementFromTextLine('10, 20, 30, 40');
  assert(JSON.stringify(placement) === JSON.stringify({ xMm: 10, yMm: 20, widthMm: 30, heightMm: 40 }), `got ${JSON.stringify(placement)}`);
  assert(EngravedImage.placementFromTextLine('10, 20, abc, 40') === null, 'expected null for an unreadable line');
});

test('readSvgSizeMm: should throw an explicit error naming the unsupported length', () => {
  let error = null;
  try {
    readSvgSizeMm('<svg xmlns="http://www.w3.org/2000/svg" width="50%" height="10mm"></svg>');
  } catch (e) {
    error = e;
  }
  assert(error !== null && error.message.includes('50%'), `expected an error naming "50%", got ${error && error.message}`);
});

test('readSvgSizeMm: should convert points at 72 per inch', () => {
  const size = readSvgSizeMm('<svg xmlns="http://www.w3.org/2000/svg" width="72pt" height="36pt"></svg>');
  assertClose(size.widthMm, 25.4);
  assertClose(size.heightMm, 12.7);
});

test('readSvgSizeMm: should throw when the SVG size is zero', () => {
  let error = null;
  try {
    readSvgSizeMm('<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0"></svg>');
  } catch (e) {
    error = e;
  }
  assert(error !== null && /size/i.test(error.message), `expected a size error, got ${error && error.message}`);
});

test('readSvgSizeMm: should read attributes written with single quotes', () => {
  const size = readSvgSizeMm("<svg xmlns='http://www.w3.org/2000/svg' width='40mm' height='25mm'></svg>");
  assertClose(size.widthMm, 40);
  assertClose(size.heightMm, 25);
});

run();
