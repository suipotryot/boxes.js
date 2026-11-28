import { imageSlotsOf } from '../image/ImageSlots.js';
import { EngravedImage } from '../geometry/oo/EngravedImage.js';
import { Box } from '../geometry/oo/Box.js';

function hasImages(piece) {
  return piece.images.length > 0;
}

function imagesByPieceId(pieces) {
  return Object.fromEntries(pieces.filter(hasImages).map((piece) => [piece.id, piece.images]));
}

export function imageSlotCountOf(templatePieces) {
  return imageSlotsOf(imagesByPieceId(templatePieces)).length;
}

export function copySlotCountOf(project) {
  return imageSlotCountOf(Box.fromProject(project).allPiecesBurnCorrected());
}

function centerOf(image) {
  return { x: image.xMm + image.widthMm / 2, y: image.yMm + image.heightMm / 2 };
}

function loadedImageCenteredOn(templateImage, loadedImage) {
  const { x, y } = centerOf(templateImage);
  return new EngravedImage({
    xMm: x - loadedImage.widthMm / 2,
    yMm: y - loadedImage.heightMm / 2,
    widthMm: loadedImage.widthMm,
    heightMm: loadedImage.heightMm,
    svg: loadedImage.svg,
  });
}

function slotKey(pieceId, imageIndex) {
  return `${pieceId}#${imageIndex}`;
}

function loadedImagesBySlotKey(slots, loadedImages) {
  if (slots.length !== loadedImages.length) {
    throw new Error(`A copy needs ${slots.length} images but ${loadedImages.length} were given`);
  }
  return new Map(slots.map((slot, position) => [slotKey(slot.pieceId, slot.index), loadedImages[position]]));
}

function withLoadedImages(piece, loadedImageOfSlot) {
  const images = piece.images.map((image, index) => loadedImageCenteredOn(image, loadedImageOfSlot.get(slotKey(piece.id, index))));
  return { ...piece, images };
}

function piecesOfCopy(templatePieces, loadedImages) {
  const slots = imageSlotsOf(imagesByPieceId(templatePieces));
  const loadedImageOfSlot = loadedImagesBySlotKey(slots, loadedImages);
  return templatePieces.map((piece) => withLoadedImages(piece, loadedImageOfSlot));
}

export function piecesForCopies(templatePieces, loadedImagesByCopy) {
  if (loadedImagesByCopy.length === 0) return templatePieces;
  return loadedImagesByCopy.flatMap((loadedImages) => piecesOfCopy(templatePieces, loadedImages));
}
