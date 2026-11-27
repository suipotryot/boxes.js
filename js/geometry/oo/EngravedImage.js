const MILLIMETRES_PATTERN = /^([\d.]+)mm$/;

function readMillimetres(svgText, attributeName) {
  const match = svgText.match(new RegExp(String.raw`<svg[^>]*\s${attributeName}="([^"]*)"`));
  return Number(match[1].match(MILLIMETRES_PATTERN)[1]);
}

export function readSvgSizeMm(svgText) {
  return {
    widthMm: readMillimetres(svgText, 'width'),
    heightMm: readMillimetres(svgText, 'height'),
  };
}
