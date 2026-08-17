import type { ColorEntry } from '../models/ColorHeightRegistry';
import type { DividerGrid } from '../models/Grid';
import type { Project } from '../models/Project';

/**
 * A divider can never exceed an active shelf's heightMm (confirmed
 * decision -- interdiction by validation, no cutout in the shelf plate).
 * Enforced at the two places that could violate it: raising a divider
 * color's height, and lowering the shelf below an existing divider.
 */
export function canSetColorHeight(project: Project, colorId: string, heightMm: number): boolean {
  const shelf = project.config.shelf;
  if (!shelf) {
    return true;
  }
  if (colorId === project.config.outerColorId) {
    return true; // the shelf attaches to the outer walls regardless of their height
  }
  if (!isColorUsedByDivider(project.grid, colorId)) {
    return true; // not in use yet, nothing to violate
  }
  return heightMm <= shelf.heightMm;
}

export function canSetShelfHeight(project: Project, heightMm: number): boolean {
  return heightMm >= tallestDividerHeightMm(project.grid, project.colors);
}

export function isColorUsedByDivider(grid: DividerGrid, colorId: string): boolean {
  return grid.lines.some((line) => line.colorId === colorId || line.segmentOverrides.some((o) => !o.removed && o.colorId === colorId));
}

export function tallestDividerHeightMm(grid: DividerGrid, colors: ColorEntry[]): number {
  const heightOf = (id: string): number => colors.find((c) => c.id === id)?.heightMm ?? 0;
  let max = 0;
  for (const line of grid.lines) {
    max = Math.max(max, heightOf(line.colorId));
    for (const override of line.segmentOverrides) {
      if (!override.removed && override.colorId) {
        max = Math.max(max, heightOf(override.colorId));
      }
    }
  }
  return max;
}
