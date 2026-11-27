import { test, assert, run } from './testHarness.js';
import { EngravedImage } from '../geometry/oo/EngravedImage.js';
import { validateImageInRect } from '../geometry/oo/ImageValidation.js';

function imageAt(xMm, yMm, widthMm = 40, heightMm = 20) {
  return new EngravedImage({ xMm, yMm, widthMm, heightMm, svg: '<svg/>' });
}

test('validateImageInRect: should accept an image fully inside the rectangle', () => {
  const result = validateImageInRect(100, 60, imageAt(30, 20));
  assert(result.ok, 'expected ok');
  assert(result.problems.length === 0, 'expected no problem');
});

test('validateImageInRect: should warn without throwing when the image exceeds the rectangle', () => {
  const result = validateImageInRect(100, 60, imageAt(80, 20));
  assert(!result.ok, 'expected not ok');
  assert(result.problems.length === 1, `expected one warning, got ${result.problems.length}`);
});

test('validateImageInRect: should warn when the image size is not positive', () => {
  const result = validateImageInRect(100, 60, imageAt(10, 10, 0, 20));
  assert(!result.ok, 'expected not ok');
  assert(result.problems.length === 1, `expected one warning, got ${result.problems.length}`);
});

run();
