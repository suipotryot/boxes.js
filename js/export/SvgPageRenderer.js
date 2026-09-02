// One standalone SVG document per export page. Cut-line styling here is
// deliberately independent of css/style.css (fill:none, a hairline
// stroke) — this file is meant to be opened by laser-cutting software
// outside this app entirely, so it can't rely on the app's own
// stylesheet; the live-editor preview's fill/stroke (a different look,
// for on-screen legibility) is a separate concern in css/style.css.
import { svgEl } from '../ui/dom.js';
import { pieceToSvgElement, pieceBounds, pieceLabelElement } from '../geometry/SvgPath.js';

const CUT_STROKE = { fill: 'none', stroke: '#000000', 'stroke-width': '0.1' };

function buildPieceGroups(items, showLabels) {
  return items.map(({ piece, x, y }) => {
    const bounds = pieceBounds(piece);
    const path = pieceToSvgElement(piece);
    path.setAttribute('fill', CUT_STROKE.fill);
    path.setAttribute('stroke', CUT_STROKE.stroke);
    path.setAttribute('stroke-width', CUT_STROKE['stroke-width']);
    const children = [path];
    if (showLabels) {
      const pieceLabel = pieceLabelElement(piece);
      if (pieceLabel) children.push(pieceLabel);
    }
    return svgEl('g', { transform: `translate(${x - bounds.minX} ${y - bounds.minY})` }, children);
  });
}

/**
 * @param {{items: {piece:object,x:number,y:number}[], pageWidthMm:number, pageHeightMm:number, label:string, showLabels?:boolean}} args
 * @returns {SVGSVGElement}
 */
export function renderSvgPage({ items, pageWidthMm, pageHeightMm, label, showLabels = false }) {
  const boundary = svgEl('rect', { x: 0, y: 0, width: pageWidthMm, height: pageHeightMm, ...CUT_STROKE });
  const pieceGroups = buildPieceGroups(items, showLabels);
  const labelEl = svgEl('text', { x: 2, y: pageHeightMm - 2, 'font-size': 3, fill: '#000000' }, [label]);

  return svgEl('svg', {
    xmlns: 'http://www.w3.org/2000/svg',
    viewBox: `0 0 ${pageWidthMm} ${pageHeightMm}`,
    width: `${pageWidthMm}mm`,
    height: `${pageHeightMm}mm`,
  }, [boundary, ...pieceGroups, labelEl]);
}

/** Where the Deepnest-oriented page-boundary rect lands, and how large the
 *  resulting canvas needs to be to fit both it and the packed pieces. The
 *  boundary is placed beside the pieces (never enclosing them): Deepnest's
 *  SVG importer treats an enclosing rect + the shapes inside it as ONE
 *  compound part (piece paths read like holes cut into the rect), instead
 *  of a list of separate parts to nest — placing it beside, with a
 *  spacingMm gap, makes Deepnest list it as its own separate, selectable
 *  part (which the user can then designate as "the sheet" in Deepnest's
 *  own UI). packPieces already guarantees every piece's bounding box sits
 *  within [0,pageWidthMm]x[0,pageHeightMm] (that's why the plain boundary
 *  rect at (0,0) encloses everything today), so starting the shifted
 *  boundary at pageWidthMm+spacingMm keeps its x-range disjoint from every
 *  piece's, regardless of piece shapes. */
export function computeDeepnestBoundaryLayout({ pageWidthMm, pageHeightMm, spacingMm }) {
  return {
    boundaryX: pageWidthMm + spacingMm,
    boundaryY: 0,
    canvasWidthMm: pageWidthMm * 2 + spacingMm,
    canvasHeightMm: pageHeightMm,
  };
}

/**
 * @param {{items: {piece:object,x:number,y:number}[], pageWidthMm:number, pageHeightMm:number, spacingMm:number, label:string, showLabels?:boolean}} args
 * @returns {SVGSVGElement}
 */
export function renderSvgPageForDeepnest({ items, pageWidthMm, pageHeightMm, spacingMm, label, showLabels = false }) {
  const { boundaryX, boundaryY, canvasWidthMm, canvasHeightMm } =
    computeDeepnestBoundaryLayout({ pageWidthMm, pageHeightMm, spacingMm });
  const boundary = svgEl('rect', { x: boundaryX, y: boundaryY, width: pageWidthMm, height: pageHeightMm, ...CUT_STROKE });
  const pieceGroups = buildPieceGroups(items, showLabels);
  const labelEl = svgEl('text', { x: 2, y: pageHeightMm - 2, 'font-size': 3, fill: '#000000' }, [label]);

  return svgEl('svg', {
    xmlns: 'http://www.w3.org/2000/svg',
    viewBox: `0 0 ${canvasWidthMm} ${canvasHeightMm}`,
    width: `${canvasWidthMm}mm`,
    height: `${canvasHeightMm}mm`,
  }, [boundary, ...pieceGroups, labelEl]);
}

/** Serializes an SVG DOM element into standalone file text, with an XML
 *  declaration — required for the file to be a valid, self-contained
 *  document when opened directly (not embedded in an HTML page). */
export function svgElementToFileText(svgElement) {
  return '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n' + new XMLSerializer().serializeToString(svgElement);
}
