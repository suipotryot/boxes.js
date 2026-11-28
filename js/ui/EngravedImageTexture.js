import * as THREE from 'three';

const PIXELS_PER_MM = 8;
const MAX_TEXTURE_SIDE_PX = 2048;

const texturesBySvgAndSize = new Map();

function decodeSvg(svg) {
  return new Promise((resolve, reject) => {
    const decodedImage = new Image();
    decodedImage.onload = () => resolve(decodedImage);
    decodedImage.onerror = () => reject(new Error('The engraved image could not be decoded'));
    decodedImage.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

function canvasSizeFor(image) {
  const pixelsPerMm = Math.min(PIXELS_PER_MM, MAX_TEXTURE_SIDE_PX / Math.max(image.widthMm, image.heightMm));
  return { widthPx: Math.ceil(image.widthMm * pixelsPerMm), heightPx: Math.ceil(image.heightMm * pixelsPerMm) };
}

function textureFromDecoded(decodedImage, image) {
  const { widthPx, heightPx } = canvasSizeFor(image);
  const canvas = document.createElement('canvas');
  canvas.width = widthPx;
  canvas.height = heightPx;
  canvas.getContext('2d').drawImage(decodedImage, 0, 0, widthPx, heightPx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function cacheKeyOf(image) {
  return `${image.widthMm}x${image.heightMm}:${image.svg}`;
}

export function engravedImageTexture(image) {
  const key = cacheKeyOf(image);
  if (!texturesBySvgAndSize.has(key)) {
    const texture = decodeSvg(image.svg).then((decodedImage) => textureFromDecoded(decodedImage, image));
    texture.catch(() => texturesBySvgAndSize.delete(key));
    texturesBySvgAndSize.set(key, texture);
  }
  return texturesBySvgAndSize.get(key);
}

export async function disposeEngravedImageTextures() {
  const textures = await Promise.allSettled([...texturesBySvgAndSize.values()]);
  texturesBySvgAndSize.clear();
  textures.filter((result) => result.status === 'fulfilled').forEach((result) => result.value.dispose());
}
