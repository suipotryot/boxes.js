export function assertWellFormedSvg(svgText) {
  const parsed = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  const parseError = parsed.querySelector('parsererror');
  if (parseError) throw new Error(`The SVG is not well-formed: ${parseError.textContent.trim()}`);
}
