import { readAttribute, readSvgSizeMm } from '../geometry/oo/EngravedImage.js';

const PIXELS_PER_MILLIMETRE = 96 / 25.4;

function prefixDeclarationsOf(svgText) {
  const openingTag = svgText.slice(svgText.indexOf('<svg'), svgText.indexOf('>', svgText.indexOf('<svg')));
  return (openingTag.match(/xmlns:\w+="[^"]*"/g) || []).map((declaration) => `${declaration} `).join('');
}

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

function centreOf(image) {
  return { x: image.xMm + image.widthMm / 2, y: image.yMm + image.heightMm / 2 };
}

export function engravedImageMarkup(image) {
  const { x, y } = centreOf(image);
  return `<g xmlns="http://www.w3.org/2000/svg" transform="rotate(180 ${x} ${y})"><svg ${prefixDeclarationsOf(image.svg)}x="${image.xMm}" y="${image.yMm}" width="${image.widthMm}" height="${image.heightMm}" viewBox="${viewBoxOf(image.svg)}" preserveAspectRatio="none">${innerContentOf(image.svg)}</svg></g>`;
}
