import { test, assert, run } from './testHarness.js';
import { EngravedImage } from '../geometry/oo/EngravedImage.js';
import { piecesForCopies, imageSlotCountOf, copySlotCountOf } from '../export/CopyPieces.js';
import { createDefaultProject } from '../state/Project.js';

const templateImage = { xMm: 10, yMm: 20, widthMm: 40, heightMm: 20, svg: '<svg id="template"/>' };
const lid = { id: 'lid', kind: 'lid', images: [new EngravedImage(templateImage)] };
const wall = { id: 'wall-v-0-0', kind: 'wall', images: [] };

test('piecesForCopies: should keep the pieces untouched when there is no copy list', () => {
  const pieces = piecesForCopies([lid, wall], []);
  assert(pieces.length === 2 && pieces[0] === lid, `got ${JSON.stringify(pieces)}`);
});

test('piecesForCopies: should repeat every piece once per copy', () => {
  const answer = { svg: '<svg/>', widthMm: 40, heightMm: 20 };
  const pieces = piecesForCopies([lid, wall], [[answer], [answer]]);
  assert(pieces.map((piece) => piece.id).join(',') === 'lid,wall-v-0-0,lid,wall-v-0-0', `got ${pieces.map((piece) => piece.id)}`);
});

test('piecesForCopies: should replace the template image with the answer of the copy', () => {
  const answers = [[{ svg: '<svg id="first"/>', widthMm: 40, heightMm: 20 }], [{ svg: '<svg id="second"/>', widthMm: 40, heightMm: 20 }]];
  const [firstLid, , secondLid] = piecesForCopies([lid, wall], answers);
  assert(firstLid.images[0].svg === '<svg id="first"/>' && secondLid.images[0].svg === '<svg id="second"/>', 'each copy should get its own svg');
});

test('piecesForCopies: should keep the center of the template slot and take the size of the answer', () => {
  const answer = { svg: '<svg/>', widthMm: 20, heightMm: 10 };
  const [copiedLid] = piecesForCopies([lid], [[answer]]);
  const image = copiedLid.images[0];
  assert(image.xMm + image.widthMm / 2 === 30 && image.yMm + image.heightMm / 2 === 30, `got ${JSON.stringify(image)}`);
  assert(image.widthMm === 20 && image.heightMm === 10, `got ${JSON.stringify(image)}`);
});

test('piecesForCopies: should throw when a copy has not as many answers as the template has images', () => {
  let message = null;
  try {
    piecesForCopies([lid], [[]]);
  } catch (error) {
    message = error.message;
  }
  assert(message?.includes('needs 1 images but 0'), `got ${message}`);
});

test('imageSlotCountOf: should count the images of all the pieces', () => {
  const twoImages = { id: 'base-plate', kind: 'lid', images: [new EngravedImage(templateImage), new EngravedImage(templateImage)] };
  assert(imageSlotCountOf([lid, wall, twoImages]) === 3, 'expected 3 slots');
});

test('copySlotCountOf: should count the images of the drawer along with those of the box', () => {
  const project = createDefaultProject();
  project.lid = { enabled: true };
  project.drawer = { ...project.drawer, enabled: true };
  project.pieceImages = { lid: [templateImage], 'drawer:lid': [templateImage] };
  assert(copySlotCountOf(project) === 2, `got ${copySlotCountOf(project)}`);
});

run();
