import { test, assert, run } from './testHarness.js';
import { imageSlotsOf } from '../image/ImageSlots.js';

const image = { xMm: 0, yMm: 0, widthMm: 10, heightMm: 10, svg: '<svg/>' };

test('imageSlotsOf: should return no slot when no piece has an image', () => {
  assert(imageSlotsOf({}).length === 0, 'expected no slot');
});

test('imageSlotsOf: should list the slots sorted by piece id then by image index', () => {
  const slots = imageSlotsOf({ lid: [image, image], 'base-plate': [image] });
  const labels = slots.map((slot) => `${slot.pieceId}#${slot.index}`).join(',');
  assert(labels === 'base-plate#0,lid#0,lid#1', `got ${labels}`);
});

test('imageSlotsOf: should ignore a piece whose image list is empty', () => {
  assert(imageSlotsOf({ lid: [] }).length === 0, 'expected no slot');
});

run();
