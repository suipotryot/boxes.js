export const IMAGE_LIFT_MM = 0.05;

export function imagePlaneOf(piece, image) {
  return {
    centerX: image.xMm + image.widthMm / 2,
    centerY: image.yMm + image.heightMm / 2,
    offsetZ: piece.thicknessMm + IMAGE_LIFT_MM,
    widthMm: image.widthMm,
    heightMm: image.heightMm,
  };
}
