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
// The model's v axis is never flipped when mapping to SVG y (see
// pieceToPathData's own comment on that), so drawn as-is a piece appears
// upside down relative to how it stands once assembled — teeth near the
// top of the viewBox instead of the bottom. Rotating everything 180° about
// the piece's own bounding-box center fixes that for on-screen display
// (a 180° rotation about that exact center maps the bounding box onto
// itself, so the viewBox math above needs no adjustment) without touching
// pieceToPathData/pieceToSvgElement/pieceBounds themselves, which the real
// export pipeline (SvgPageRenderer.js) also relies on and whose own
// orientation convention is untouched by this. As a side effect, this
// exactly cancels pieceLabelElement's own 180° pre-rotation, so a label
// reads upright here too. `.piece-space` is also where interactive
// overlays (e.g. hole drag handles) get attached, in this same rotated
// coordinate space.
export function pieceToStandaloneSvg(piece, { padding = 10, minSize = 0, showLabels = false } = {}) {
  const bounds = pieceBounds(piece);
  const w = bounds.width + padding * 2;
  const h = bounds.height + padding * 2;
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `${bounds.minX - padding} ${bounds.minY - padding} ${w} ${h}`);
  svg.setAttribute('width', Math.max(minSize, w));
  svg.setAttribute('height', Math.max(minSize, h));
  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  group.setAttribute('class', 'piece-space');
  group.setAttribute('transform', `rotate(180 ${cx} ${cy})`);
  group.appendChild(pieceToSvgElement(piece));
  if (showLabels) {
    const labelEl = pieceLabelElement(piece);
    if (labelEl) group.appendChild(labelEl);
  }
  svg.appendChild(group);
  return svg;
}

// A short, human-readable identifier for a WALL piece only (outer wall or
// interior divider) — null for the base plate/lid, which are flat
// footprints with no "bottom edge" for a label to sit near (see
// pieceLabelElement). Derived from thicknessGroup (matching the
// extérieure/intérieure vocabulary SettingsPanel.js already uses) plus the
// grid coordinates already embedded in PanelBuilder.wallPieceId's own id
// format, so this never drifts out of sync with the id itself.
export function pieceLabel(piece) {
  if (piece.kind !== 'wall') return null;
  const [, axis, x, y] = piece.id.split('-');
  const group = piece.thicknessGroup === 'outer' ? 'Paroi' : 'Cloison';
  return `${group} ${axis.toUpperCase()}${x},${y}`;
}

const LABEL_MARGIN_MM = 2; // clearance from v=0 (the base-plate joint line) to the bottom of the label text
const LABEL_FONT_SIZE_MM = 3;

// Horizontal position: piece.labelU (PanelBuilder.labelAnchorU) — normally
// a fixed margin in from the run's own right end, clamped against the
// nearest junction's exclusion zone (a mortise hole or X-crossing notch)
// so the label never lands over one — is the label's own RIGHT edge, not
// its center. Paired with text-anchor:'start' rather than 'end': anchoring
// 'start' at that point BEFORE the 180° rotation below is what makes it
// land 'end'-aligned (flush with piece.labelU, extending left into the
// gap) AFTER — since both the anchor and the rotation center are the same
// point, this holds regardless of the text's own rendered width, without
// ever needing to measure it (unlike anchoring 'end' pre-rotation, which
// would rotate the whole run to the WRONG side of that point instead).
// Vertical position: near v=0 — a wall's own stable bottom-edge coordinate
// (PanelBuilder's bottomEdgePoints: fingers protrude BELOW v=0 into the base plate, flush
// stretches sit AT v=0, so v=0 itself is always clear of every tooth) —
// rather than pieceBounds().minY, which includes those protruding teeth
// and would put the label too low/overlapping them.
// Unfilled (stroke only, no fill): a laser engraves a filled glyph as a
// slow raster fill, but traces an unfilled outline as a fast vector line —
// same hairline convention as the cut lines themselves (SvgPageRenderer's
// CUT_STROKE).
//
// Rotated 180° about its own anchor: this file never flips the model's v
// axis when mapping to SVG y (see pieceToPathData — v and y are the same
// number), so v=0 (a wall's physical BOTTOM, the base-plate edge) lands at
// a small y — near the top of the drawing — while v=height (the physical
// TOP) lands near the bottom. Reading the file as drawn, the piece is
// upside down relative to how it actually stands once assembled
// (base-plate edge down); the assembler corrects for that by spinning the
// physical piece 180° in-plane before fitting it. Text drawn upright IN
// THE FILE would therefore read upside down at that point — pre-rotating
// it 180° here means it reads right side up exactly when the piece is
// oriented for real assembly, not when merely looking at the flat export.
export function pieceLabelElement(piece) {
  const text = pieceLabel(piece);
  if (text == null) return null;
  const cx = piece.labelU;
  const cy = LABEL_MARGIN_MM + LABEL_FONT_SIZE_MM / 2;
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  el.setAttribute('x', cx);
  el.setAttribute('y', cy);
  el.setAttribute('transform', `rotate(180 ${cx} ${cy})`);
  el.setAttribute('font-size', LABEL_FONT_SIZE_MM);
  el.setAttribute('fill', 'none');
  el.setAttribute('stroke', '#000000');
  el.setAttribute('stroke-width', '0.1');
  el.setAttribute('text-anchor', 'start');
  el.setAttribute('dominant-baseline', 'middle');
  el.textContent = text;
  return el;
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
