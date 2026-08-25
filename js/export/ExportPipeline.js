// Orchestrates the whole multi-page SVG export: computePieces -> group by
// thickness -> pack each group's pieces onto laser-bed-sized pages.
// Split into a pure planning step (planExport, no DOM — fully unit
// testable) and the actual download side effects (exportProjectSvg, needs
// a browser), same separation this app already keeps elsewhere between
// pure geometry/state and DOM-touching UI code.
import { computePieces } from '../geometry/PieceFactory.js';
import { groupByThickness } from './ThicknessGrouper.js';
import { packPieces } from './RectPacker.js';
import { renderSvgPage, svgElementToFileText } from './SvgPageRenderer.js';

function sanitizeFilename(name) {
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
 *  page item lists) so a caller can show a summary afterward. */
export async function exportProjectSvg(project, { delayMs = 300, labels = false } = {}) {
  const plan = planExport(project);
  const { widthMm, heightMm } = project.laserBed;

  for (const { thicknessMm, pages } of plan) {
    for (let i = 0; i < pages.length; i++) {
      const label = `${project.name} — ${thicknessMm}mm — page ${i + 1}/${pages.length}`;
      const svg = renderSvgPage({ items: pages[i], pageWidthMm: widthMm, pageHeightMm: heightMm, label, showLabels: labels });
      const filename = `${sanitizeFilename(project.name)}-${thicknessMm}mm-p${i + 1}sur${pages.length}.svg`;
      downloadText(filename, svgElementToFileText(svg));
      await sleep(delayMs);
    }
  }

  return plan;
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
