const MILLIMETRES_PER_UNIT = { mm: 1, cm: 10, in: 25.4, px: 25.4 / 96, '': 25.4 / 96 };
const LENGTH_PATTERN = /^([\d.]+)(mm|cm|in|px)?$/;

function convertToMillimetres(lengthText) {
  const [, amount, unit = ''] = lengthText.match(LENGTH_PATTERN);
  return Number(amount) * MILLIMETRES_PER_UNIT[unit];
}

function readAttribute(svgText, attributeName) {
  const match = svgText.match(new RegExp(String.raw`<svg[^>]*\s${attributeName}="([^"]*)"`));
  return match ? match[1] : null;
}

function hasWidthAndHeight(svgText) {
  return readAttribute(svgText, 'width') !== null && readAttribute(svgText, 'height') !== null;
}

function readViewBoxSizeMm(svgText) {
  if (readAttribute(svgText, 'viewBox') === null) {
    throw new Error('The SVG has no readable size: width/height or viewBox is required');
  }
  const [, , width, height] = readAttribute(svgText, 'viewBox').trim().split(/[\s,]+/);
  return { widthMm: convertToMillimetres(width), heightMm: convertToMillimetres(height) };
}

function assertIsSvg(svgText) {
  if (!/<svg[\s>]/.test(svgText)) {
    throw new Error('The pasted text is not an SVG: no <svg> element found');
  }
}

export function readSvgSizeMm(svgText) {
  assertIsSvg(svgText);
  if (!hasWidthAndHeight(svgText)) return readViewBoxSizeMm(svgText);
  return {
    widthMm: convertToMillimetres(readAttribute(svgText, 'width')),
    heightMm: convertToMillimetres(readAttribute(svgText, 'height')),
  };
}

export class EngravedImage {
  constructor({ xMm, yMm, widthMm, heightMm, svg }) {
    this.xMm = xMm;
    this.yMm = yMm;
    this.widthMm = widthMm;
    this.heightMm = heightMm;
    this.svg = svg;
  }

  static centeredIn(svg, areaWidthMm, areaHeightMm) {
    const { widthMm, heightMm } = readSvgSizeMm(svg);
    return new EngravedImage({
      xMm: (areaWidthMm - widthMm) / 2,
      yMm: (areaHeightMm - heightMm) / 2,
      widthMm,
      heightMm,
      svg,
    });
  }
}
