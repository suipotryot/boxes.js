import { HALF_TURN_DEG } from './oo/EngravedImage.js';

export const IMAGE_LIFT_MM = 0.05;

export function imagePlaneOf(piece, image) {
  const { widthMm, heightMm } = image.contentSize();
  return {
    centerX: image.xMm + image.widthMm / 2,
    centerY: image.yMm + image.heightMm / 2,
    offsetZ: piece.thicknessMm + IMAGE_LIFT_MM,
    widthMm,
    heightMm,
    rotationRad: (image.rotationDeg * Math.PI) / HALF_TURN_DEG,
  };
}
