// Orchestrates the whole multi-page SVG export: computePieces -> group by
// thickness -> pack each group's pieces onto laser-bed-sized pages.
// Split into a pure planning step (planExport, no DOM — fully unit
// testable) and the actual download side effects (exportProjectSvg, needs
// a browser), same separation this app already keeps elsewhere between
// pure geometry/state and DOM-touching UI code.
import { computePieces } from '../geometry/PieceFactory.js';
import { groupByThickness } from './ThicknessGrouper.js';
import { packPieces } from './RectPacker.js';
import { renderSvgPage, renderSvgPageForDeepnest, svgElementToFileText } from './SvgPageRenderer.js';

export function sanitizeFilename(name) {
  return (name || 'projet').replace(/[^\w-]+/g, '_');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Pure planning step: what pages would be produced, with no side
 *  effects. Lets the export UI show a page-count summary before
 *  committing to actual downloads, and is unit-testable without a
 *  browser (computePieces/groupByThickness/packPieces are all pure). */
export function planExport(project) {
  const pieces = computePieces(project);
  const groups = groupByThickness(pieces);
  const { widthMm, heightMm, spacingMm } = project.laserBed;
  return groups.map(({ thicknessMm, pieces }) => ({
    thicknessMm,
    pages: packPieces(pieces, widthMm, heightMm, spacingMm),
  }));
}

/** Triggers one file download per page, sequentially with a short delay
 *  between each — browsers block or warn on several downloads fired from
 *  the same synchronous call stack, so this can't just loop and click
 *  every link back to back. Returns the plan (thickness groups + their
 *  page item lists) so a caller can show a summary afterward. Shared by
 *  exportProjectSvg and exportProjectSvgForDeepnest, which differ only in
 *  which page-renderer they use (plain enclosing boundary vs. Deepnest's
 *  separate one) and their filename suffix — the suffix keeps the two from
 *  overwriting each other's downloads when exported back to back for the
 *  same project/thickness/page. */
async function runSvgExport(project, { delayMs, labels, renderPage, filenameSuffix = '' }) {
  const plan = planExport(project);
  const { widthMm, heightMm, spacingMm } = project.laserBed;

  for (const { thicknessMm, pages } of plan) {
    for (let i = 0; i < pages.length; i++) {
      const label = `${project.name} — ${thicknessMm}mm — page ${i + 1}/${pages.length}`;
      const svg = renderPage({ items: pages[i], pageWidthMm: widthMm, pageHeightMm: heightMm, spacingMm, label, showLabels: labels });
      const filename = `${sanitizeFilename(project.name)}-${thicknessMm}mm-p${i + 1}sur${pages.length}${filenameSuffix}.svg`;
      downloadText(filename, svgElementToFileText(svg));
      await sleep(delayMs);
    }
  }

  return plan;
}

export async function exportProjectSvg(project, { delayMs = 300, labels = false } = {}) {
  return runSvgExport(project, { delayMs, labels, renderPage: renderSvgPage });
}

/** Same content as exportProjectSvg (same pieces, pagination, labels), but
 *  the page-boundary rect sits beside the packed pieces instead of
 *  enclosing them — see computeDeepnestBoundaryLayout's own comment for
 *  why: Deepnest's SVG importer otherwise reads the enclosed pieces as
 *  holes of one compound part instead of a list of separate parts. */
export async function exportProjectSvgForDeepnest(project, { delayMs = 300, labels = false } = {}) {
  return runSvgExport(project, { delayMs, labels, renderPage: renderSvgPageForDeepnest, filenameSuffix: '-deepnest' });
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
