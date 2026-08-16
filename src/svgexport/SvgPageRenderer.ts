import type { InnerCornerStyle } from '@/domain/models/Project';
import { boundingBox } from './nesting/MaxRectsPacker';
import type { PlacedPanel } from './nesting/types';
import { buildPanelPath } from './SvgPathBuilder';

/** Renders one laser-bed page as a standalone SVG document: one `<g>` per
 * placed panel (translated -- and rotated, for pieces the packer flipped
 * 90 degrees -- into its packed position) plus a thickness/page label in
 * the margin, clear of every piece. */
export function renderSvgPage(
  placedPanels: PlacedPanel[],
  bedWidthMm: number,
  bedHeightMm: number,
  thicknessMm: number,
  burnMm: number,
  cornerStyle: InnerCornerStyle,
  pageLabel: string,
): string {
  const groups = placedPanels.map((placed) => {
    const box = boundingBox(placed.panel.outline);
    const pathD = buildPanelPath(placed.panel, burnMm, cornerStyle);
    const transform = placed.rotated
      ? `translate(${placed.x + box.height} ${placed.y}) rotate(90) translate(${-box.x} ${-box.y})`
      : `translate(${placed.x - box.x} ${placed.y - box.y})`;
    return `<g transform="${transform}"><path d="${pathD}" fill="none" stroke="#000000" stroke-width="0.1" fill-rule="evenodd" /></g>`;
  });

  const label = `<text x="4" y="${bedHeightMm - 4}" font-size="6" fill="#888888">${escapeXml(pageLabel)} - ${thicknessMm}mm</text>`;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${bedWidthMm}mm" height="${bedHeightMm}mm" ` +
    `viewBox="0 0 ${bedWidthMm} ${bedHeightMm}">${groups.join('')}${label}</svg>`
  );
}

function escapeXml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&apos;';
    }
  });
}
