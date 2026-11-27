import { readAttribute } from '../geometry/oo/EngravedImage.js';

function innerContentOf(svgText) {
  const openingTagEnd = svgText.indexOf('>', svgText.indexOf('<svg')) + 1;
  return svgText.slice(openingTagEnd, svgText.lastIndexOf('</svg>'));
}

export function engravedImageMarkup(image) {
  const viewBox = readAttribute(image.svg, 'viewBox');
  return `<svg x="${image.xMm}" y="${image.yMm}" width="${image.widthMm}" height="${image.heightMm}" viewBox="${viewBox}">${innerContentOf(image.svg)}</svg>`;
}
