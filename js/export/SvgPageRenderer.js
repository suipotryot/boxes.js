// One standalone SVG document per export page. Cut-line styling here is
// deliberately independent of css/style.css (fill:none, a hairline
// stroke) — this file is meant to be opened by laser-cutting software
// outside this app entirely, so it can't rely on the app's own
// stylesheet; the live-editor preview's fill/stroke (a different look,
// for on-screen legibility) is a separate concern in css/style.css.
import { svgEl } from '../ui/dom.js';
import { pieceToSvgElement, pieceBounds, pieceLabelElement } from '../geometry/SvgPath.js';

const CUT_STROKE = { fill: 'none', stroke: '#000000', 'stroke-width': '0.1' };

/**
 * @param {{items: {piece:object,x:number,y:number}[], pageWidthMm:number, pageHeightMm:number, label:string, showLabels?:boolean}} args
 * @returns {SVGSVGElement}
 */
export function renderSvgPage({ items, pageWidthMm, pageHeightMm, label, showLabels = false }) {
  const boundary = svgEl('rect', { x: 0, y: 0, width: pageWidthMm, height: pageHeightMm, ...CUT_STROKE });

  const pieceGroups = items.map(({ piece, x, y }) => {
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

  const labelEl = svgEl('text', { x: 2, y: pageHeightMm - 2, 'font-size': 3, fill: '#000000' }, [label]);

  return svgEl('svg', {
    xmlns: 'http://www.w3.org/2000/svg',
    viewBox: `0 0 ${pageWidthMm} ${pageHeightMm}`,
    width: `${pageWidthMm}mm`,
    height: `${pageHeightMm}mm`,
  }, [boundary, ...pieceGroups, labelEl]);
}

/** Serializes an SVG DOM element into standalone file text, with an XML
 *  declaration — required for the file to be a valid, self-contained
 *  document when opened directly (not embedded in an HTML page). */
export function svgElementToFileText(svgElement) {
  return '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n' + new XMLSerializer().serializeToString(svgElement);
}
