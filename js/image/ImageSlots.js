function slotsOfPiece(pieceImages, pieceId) {
  return Array.from({ length: pieceImages[pieceId].length }, (_, index) => ({ pieceId, index }));
}

export function imageSlotsOf(pieceImages) {
  return Object.keys(pieceImages).sort().flatMap((pieceId) => slotsOfPiece(pieceImages, pieceId));
}
