import Konva from 'konva';

import type { Axis, Rect } from '@/domain/models/types';

/**
 * Draws a single dashed "ghost" line spanning the full box on `axis`,
 * following the cursor while "add a line" mode is armed -- replaces the
 * old per-zone clickable-rect renderer (ZoneRenderer) now that there are no
 * more zones to click, only lines to place. Colored red when the current
 * position is invalid (too close to the box edge or to an existing line of
 * the same axis) so the user gets live feedback before clicking.
 */
export function renderLinePlacementGhost(layer: Konva.Layer, innerRect: Rect, outerThickness: number, axis: Axis, positionMm: number, valid: boolean): void {
  layer.destroyChildren();
  const pad = outerThickness;
  const points =
    axis === 'x'
      ? [innerRect.x + positionMm, innerRect.y - pad, innerRect.x + positionMm, innerRect.y + innerRect.height + pad]
      : [innerRect.x - pad, innerRect.y + positionMm, innerRect.x + innerRect.width + pad, innerRect.y + positionMm];
  const line = new Konva.Line({
    points,
    stroke: valid ? 'rgba(120, 170, 220, 0.9)' : 'rgba(220, 90, 90, 0.9)',
    strokeWidth: 1.5,
    dash: [6, 4],
    listening: false,
  });
  layer.add(line);
  layer.batchDraw();
}

export function clearLinePlacementGhost(layer: Konva.Layer): void {
  layer.destroyChildren();
  layer.batchDraw();
}
