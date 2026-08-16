import Konva from 'konva';

import type { ColorEntry } from '@/domain/models/ColorHeightRegistry';
import type { WallSegment } from '@/domain/models/WallSegment';

export interface WallRendererCallbacks {
  onClick: (wallId: string) => void;
  onHoverChange: (wallId: string | null) => void;
}

/**
 * Draws each wall as a plan-view strip (its centerline, `thickness` wide),
 * colored by its resolved ColorEntry. This intentionally does not use the
 * finger-jointed Panel.outline from PanelBuilder -- that outline is an
 * *unrolled elevation* (local u/v frame meant for 3D placement and SVG
 * export), not a top-down footprint, so the plan view renders directly from
 * WallSegment instead.
 */
export function renderWalls(
  layer: Konva.Layer,
  walls: WallSegment[],
  colors: ColorEntry[],
  selectedWallId: string | null,
  callbacks: WallRendererCallbacks,
): void {
  layer.destroyChildren();
  const colorById = new Map(colors.map((c) => [c.id, c.color]));

  for (const wall of walls) {
    const length = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y);
    const angle = Math.atan2(wall.b.y - wall.a.y, wall.b.x - wall.a.x);
    const fill = colorById.get(wall.colorId) ?? '#888888';
    const isSelected = wall.id === selectedWallId;

    // Konva rotates a shape around its (x,y) anchor; drawing the rect with
    // offsetY = thickness/2 centers it on the wall's line before rotating
    // the whole strip around wall.a by the wall's own direction angle.
    const shape = new Konva.Rect({
      x: wall.a.x,
      y: wall.a.y,
      offsetX: 0,
      offsetY: wall.thickness / 2,
      width: length,
      height: wall.thickness,
      rotation: (angle * 180) / Math.PI,
      fill,
      stroke: isSelected ? '#ffffff' : 'rgba(0,0,0,0.35)',
      strokeWidth: isSelected ? 1.5 : 0.3,
      name: `wall-${wall.id}`,
    });

    shape.on('click tap', () => callbacks.onClick(wall.id));
    shape.on('mouseenter', () => callbacks.onHoverChange(wall.id));
    shape.on('mouseleave', () => callbacks.onHoverChange(null));
    layer.add(shape);
  }
  layer.batchDraw();
}
