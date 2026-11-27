const MILLIMETRES_PATTERN = /^([\d.]+)mm$/;

function readMillimetres(svgText, attributeName) {
  const match = svgText.match(new RegExp(String.raw`<svg[^>]*\s${attributeName}="([^"]*)"`));
  return Number(match[1].match(MILLIMETRES_PATTERN)[1]);
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
