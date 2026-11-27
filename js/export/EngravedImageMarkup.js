import { readAttribute, readSvgSizeMm } from '../geometry/oo/EngravedImage.js';

const PIXELS_PER_MILLIMETRE = 96 / 25.4;

function innerContentOf(svgText) {
  const openingTagEnd = svgText.indexOf('>', svgText.indexOf('<svg')) + 1;
  return svgText.slice(openingTagEnd, svgText.lastIndexOf('</svg>'));
}

function millimetresToRoundedPixels(millimetres) {
  return Math.round(millimetres * PIXELS_PER_MILLIMETRE * 1e6) / 1e6;
}

function viewBoxOf(svgText) {
  const declared = readAttribute(svgText, 'viewBox');
  if (declared !== null) return declared;
  const { widthMm, heightMm } = readSvgSizeMm(svgText);
  return `0 0 ${millimetresToRoundedPixels(widthMm)} ${millimetresToRoundedPixels(heightMm)}`;
}

export function engravedImageMarkup(image) {
  return `<svg x="${image.xMm}" y="${image.yMm}" width="${image.widthMm}" height="${image.heightMm}" viewBox="${viewBoxOf(image.svg)}">${innerContentOf(image.svg)}</svg>`;
}
