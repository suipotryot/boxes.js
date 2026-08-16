import type { Project } from '@/domain/models/Project';
import { generatePanels } from '@/domain/services/ProjectGenerator';
import { packThicknessGroup } from './nesting/MaxRectsPacker';
import { renderSvgPage } from './SvgPageRenderer';
import { groupByThickness } from './ThicknessGrouper';

export interface ExportFile {
  filename: string;
  content: string;
}

const DOWNLOAD_DELAY_MS = 150;

/** Pure planning step -- generates every page's SVG content and filename,
 * with no DOM interaction, so it's testable without a browser. */
export function buildExportFiles(project: Project): ExportFile[] {
  const panels = generatePanels(project);
  const groups = groupByThickness(panels);
  const { laserBedX, laserBedY, burnMm, innerCornerStyle, partSpacingMm } = project.config.advanced;

  const files: ExportFile[] = [];
  for (const [thickness, groupPanels] of groups) {
    const pages = packThicknessGroup(groupPanels, laserBedX, laserBedY, partSpacingMm, true);
    pages.forEach((page, index) => {
      const pageLabel = `page ${index + 1}/${pages.length}`;
      const svg = renderSvgPage(page, laserBedX, laserBedY, thickness, burnMm, innerCornerStyle, pageLabel);
      files.push({
        filename: `${sanitize(project.name)}-${thickness}mm-page${index + 1}of${pages.length}.svg`,
        content: svg,
      });
    });
  }
  return files;
}

/** Downloads every page sequentially, with a short delay between each --
 * triggering several downloads in the same tick gets blocked by most
 * browsers' popup/multi-download guard. */
export async function exportProject(project: Project): Promise<void> {
  const files = buildExportFiles(project);
  for (const file of files) {
    downloadFile(file.filename, file.content);
    await sleep(DOWNLOAD_DELAY_MS);
  }
}

function downloadFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function sanitize(name: string): string {
  return name.trim().replace(/[\\/:*?"<>|]/g, '_') || 'boxes-project';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
