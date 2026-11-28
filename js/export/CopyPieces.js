import { imageSlotsOf } from '../image/ImageSlots.js';
import { EngravedImage } from '../geometry/oo/EngravedImage.js';

function imagesByPieceId(pieces) {
  return Object.fromEntries(pieces.filter((piece) => piece.images.length > 0).map((piece) => [piece.id, piece.images]));
}

function centerOf(image) {
  return { x: image.xMm + image.widthMm / 2, y: image.yMm + image.heightMm / 2 };
}

function answerCenteredOn(templateImage, answer) {
  const { x, y } = centerOf(templateImage);
  return new EngravedImage({
    xMm: x - answer.widthMm / 2,
    yMm: y - answer.heightMm / 2,
    widthMm: answer.widthMm,
    heightMm: answer.heightMm,
    svg: answer.svg,
  });
}

function answersBySlot(slots, answers) {
  if (slots.length !== answers.length) {
    throw new Error(`A copy needs ${slots.length} images but ${answers.length} were given`);
  }
  return new Map(slots.map((slot, position) => [`${slot.pieceId}#${slot.index}`, answers[position]]));
}

function withAnswers(piece, copyNumber, answerOfSlot) {
  const images = piece.images.map((image, index) => answerCenteredOn(image, answerOfSlot.get(`${piece.id}#${index}`)));
  return { ...piece, images, copyNumber };
}

export function imageSlotCountOf(templatePieces) {
  return imageSlotsOf(imagesByPieceId(templatePieces)).length;
}

function piecesOfCopy(templatePieces, answers, copyNumber) {
  const slots = imageSlotsOf(imagesByPieceId(templatePieces));
  const answerOfSlot = answersBySlot(slots, answers);
  return templatePieces.map((piece) => withAnswers(piece, copyNumber, answerOfSlot));
}

export function piecesForCopies(templatePieces, answersByCopy) {
  if (answersByCopy.length === 0) return templatePieces;
  return answersByCopy.flatMap((answers, copyIndex) => piecesOfCopy(templatePieces, answers, copyIndex + 1));
}
