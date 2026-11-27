import { test, assert, run } from './testHarness.js';
import { EngravedImage } from '../geometry/oo/EngravedImage.js';
import { engravedImageMarkup } from '../export/EngravedImageMarkup.js';

test('engravedImageMarkup: should nest the SVG content at the image position and size, keeping its viewBox', () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 5" width="40mm" height="20mm"><rect width="10" height="5"/></svg>';
  const image = new EngravedImage({ xMm: 30, yMm: 20, widthMm: 40, heightMm: 20, svg });
  const markup = engravedImageMarkup(image);
  assert(markup.startsWith('<svg '), `got ${markup}`);
  assert(markup.includes('x="30" y="20" width="40" height="20"'), `got ${markup}`);
  assert(markup.includes('viewBox="0 0 10 5"'), `got ${markup}`);
  assert(markup.includes('<rect width="10" height="5"/>'), `got ${markup}`);
});

run();
