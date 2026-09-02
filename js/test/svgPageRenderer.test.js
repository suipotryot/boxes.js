// computeDeepnestBoundaryLayout is the one pure/risky calculation behind
// renderSvgPageForDeepnest — it decides where the page-boundary rect lands
// relative to the packed pieces. It must sit beside them, never enclosing
// them: Deepnest's SVG importer treats an enclosing rect + the pieces it
// contains as a single compound part (piece paths read like holes), so
// this shift is what makes Deepnest list the boundary as its own separate,
// selectable part instead. renderSvgPage/renderSvgPageForDeepnest
// themselves touch document.createElementNS and are verified live instead
// (no DOM in this project's Node test harness), same convention as
// pieceLabelElement/pieceToStandaloneSvg (see svgPath.test.js).
import { test, assert, run } from './testHarness.js';
import { computeDeepnestBoundaryLayout } from '../export/SvgPageRenderer.js';

test('computeDeepnestBoundaryLayout places the boundary beside the page with a spacingMm gap', () => {
  const layout = computeDeepnestBoundaryLayout({ pageWidthMm: 600, pageHeightMm: 400, spacingMm: 5 });
  assert(layout.boundaryX === 605, `expected boundaryX 605, got ${layout.boundaryX}`);
  assert(layout.boundaryY === 0, `expected boundaryY 0, got ${layout.boundaryY}`);
});

test('computeDeepnestBoundaryLayout widens the canvas to exactly fit both the pieces area and the shifted boundary', () => {
  const layout = computeDeepnestBoundaryLayout({ pageWidthMm: 600, pageHeightMm: 400, spacingMm: 5 });
  assert(layout.canvasWidthMm === 1205, `expected canvasWidthMm 1205, got ${layout.canvasWidthMm}`);
  assert(layout.boundaryX + 600 === layout.canvasWidthMm, "the shifted boundary's right edge should exactly reach the canvas edge");
});

test('computeDeepnestBoundaryLayout leaves the page height unchanged', () => {
  const layout = computeDeepnestBoundaryLayout({ pageWidthMm: 600, pageHeightMm: 400, spacingMm: 5 });
  assert(layout.canvasHeightMm === 400, `expected canvasHeightMm to equal pageHeightMm, got ${layout.canvasHeightMm}`);
});

test('computeDeepnestBoundaryLayout keeps the boundary and pieces area disjoint even with zero spacing', () => {
  const layout = computeDeepnestBoundaryLayout({ pageWidthMm: 100, pageHeightMm: 50, spacingMm: 0 });
  assert(layout.boundaryX === 100, `expected boundaryX to start exactly at the pieces area's right edge, got ${layout.boundaryX}`);
});

run();
