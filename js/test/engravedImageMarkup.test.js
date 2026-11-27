import { test, assert, run } from './testHarness.js';
import { EngravedImage } from '../geometry/oo/EngravedImage.js';
import { engravedImageMarkup } from '../export/EngravedImageMarkup.js';

test('engravedImageMarkup: should nest the SVG content at the image position and size, keeping its viewBox', () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 5" width="40mm" height="20mm"><rect width="10" height="5"/></svg>';
  const image = new EngravedImage({ xMm: 30, yMm: 20, widthMm: 40, heightMm: 20, svg });
  const markup = engravedImageMarkup(image);
  assert(markup.includes('<svg '), `got ${markup}`);
  assert(markup.includes('x="30" y="20" width="40" height="20"'), `got ${markup}`);
  assert(markup.includes('viewBox="0 0 10 5"'), `got ${markup}`);
  assert(markup.includes('<rect width="10" height="5"/>'), `got ${markup}`);
});

test('engravedImageMarkup: should derive the viewBox from the size in pixels when the SVG has none', () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="25.4mm" height="12.7mm"><rect/></svg>';
  const image = new EngravedImage({ xMm: 0, yMm: 0, widthMm: 25.4, heightMm: 12.7, svg });
  const markup = engravedImageMarkup(image);
  assert(markup.includes('viewBox="0 0 96 48"'), `got ${markup}`);
});

test('engravedImageMarkup: should turn the image by 180 degrees around its centre so it reads upright on the assembled piece', () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 5"></svg>';
  const image = new EngravedImage({ xMm: 30, yMm: 20, widthMm: 40, heightMm: 20, svg });
  const markup = engravedImageMarkup(image);
  assert(markup.startsWith('<g transform="rotate(180 50 30)">'), `got ${markup}`);
  assert(markup.endsWith('</g>'), `got ${markup}`);
});

test('engravedImageMarkup: should declare the SVG namespace on the wrapper so the exported elements are not namespace-less', () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 5"></svg>';
  const image = new EngravedImage({ xMm: 0, yMm: 0, widthMm: 10, heightMm: 5, svg });
  const markup = engravedImageMarkup(image);
  assert(markup.startsWith('<g xmlns="http://www.w3.org/2000/svg" transform='), `got ${markup}`);
});

run();
