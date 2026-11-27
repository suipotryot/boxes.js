const MILLIMETRES_PER_UNIT = { mm: 1, cm: 10, in: 25.4, px: 25.4 / 96, '': 25.4 / 96 };
const LENGTH_PATTERN = /^([\d.]+)(mm|cm|in|px)?$/;

function convertToMillimetres(lengthText) {
  const [, amount, unit = ''] = lengthText.match(LENGTH_PATTERN);
  return Number(amount) * MILLIMETRES_PER_UNIT[unit];
}

function readMillimetres(svgText, attributeName) {
  const match = svgText.match(new RegExp(String.raw`<svg[^>]*\s${attributeName}="([^"]*)"`));
  return convertToMillimetres(match[1]);
}

function assertIsSvg(svgText) {
  if (!/<svg[\s>]/.test(svgText)) {
    throw new Error('The pasted text is not an SVG: no <svg> element found');
  }
}

export function readSvgSizeMm(svgText) {
  assertIsSvg(svgText);
  return {
    widthMm: readMillimetres(svgText, 'width'),
    heightMm: readMillimetres(svgText, 'height'),
  };
}
