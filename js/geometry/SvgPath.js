// The one "points -> SVG" function in the app. Used identically by the
// live interactive editor (DOM <path> elements) and by static export
// (path data strings written into a standalone <svg> document) — that
// reuse is the whole point of the unified-pipeline architecture.

function subpath(points) {
  return 'M' + points.map((p) => `${round(p.x)},${round(p.y)}`).join('L') + 'Z';
}

function round(n) {
  return Math.round(n * 1000) / 1000;
}

export function pieceToPathData(piece) {
  return [subpath(piece.outline), ...piece.holes.map(subpath)].join(' ');
}

export function pieceToSvgElement(piece, { interactive = false } = {}) {
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', pieceToPathData(piece));
  path.setAttribute('fill-rule', 'evenodd');
  if (interactive) path.dataset.pieceId = piece.id;
  return path;
}

/** A ready-to-insert standalone <svg> for one piece, sized to its bounds
 *  plus padding. Used identically for the full-size preview strip and (in
 *  a smaller instance) anywhere else a quick piece thumbnail is needed. */
export function pieceToStandaloneSvg(piece, { padding = 10, minSize = 0 } = {}) {
  const bounds = pieceBounds(piece);
  const w = bounds.width + padding * 2;
  const h = bounds.height + padding * 2;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `${bounds.minX - padding} ${bounds.minY - padding} ${w} ${h}`);
  svg.setAttribute('width', Math.max(minSize, w));
  svg.setAttribute('height', Math.max(minSize, h));
  svg.appendChild(pieceToSvgElement(piece));
  return svg;
}

export function pieceBounds(piece) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of piece.outline) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}
