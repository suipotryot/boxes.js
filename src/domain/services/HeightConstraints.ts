import type { ColorEntry } from '../models/ColorHeightRegistry';
import type { Project } from '../models/Project';
import type { ZoneNode } from '../models/Zone';

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
  if (!isColorUsedByDivider(project.zoneTree, colorId)) {
    return true; // not in use yet, nothing to violate
  }
  return heightMm <= shelf.heightMm;
}

export function canSetShelfHeight(project: Project, heightMm: number): boolean {
  return heightMm >= tallestDividerHeightMm(project.zoneTree, project.colors);
}

export function isColorUsedByDivider(zoneTree: ZoneNode, colorId: string): boolean {
  if (zoneTree.kind === 'leaf') {
    return false;
  }
  return (
    zoneTree.dividerColorId === colorId ||
    isColorUsedByDivider(zoneTree.first, colorId) ||
    isColorUsedByDivider(zoneTree.second, colorId)
  );
}

export function tallestDividerHeightMm(zoneTree: ZoneNode, colors: ColorEntry[]): number {
  if (zoneTree.kind === 'leaf') {
    return 0;
  }
  const ownHeight = colors.find((c) => c.id === zoneTree.dividerColorId)?.heightMm ?? 0;
  return Math.max(
    ownHeight,
    tallestDividerHeightMm(zoneTree.first, colors),
    tallestDividerHeightMm(zoneTree.second, colors),
  );
}
