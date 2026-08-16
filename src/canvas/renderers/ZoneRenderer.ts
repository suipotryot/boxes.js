import Konva from 'konva';

import type { Rect } from '@/domain/models/types';
import type { ZoneNode } from '@/domain/models/Zone';
import { computeZoneRects } from '@/domain/services/ZoneTree';

export interface ZoneRendererCallbacks {
  onClick: (zoneId: string) => void;
  onHoverChange: (zoneId: string | null) => void;
}

/** Draws one clickable Konva.Rect per leaf zone -- the split targets. */
export function renderZones(
  layer: Konva.Layer,
  zoneTree: ZoneNode,
  innerRect: Rect,
  innerThickness: number,
  callbacks: ZoneRendererCallbacks,
): void {
  layer.destroyChildren();
  const rects = computeZoneRects(zoneTree, innerRect, innerThickness);
  const leafIds = new Set(collectLeafIds(zoneTree));

  for (const [id, rect] of rects) {
    if (!leafIds.has(id)) {
      continue;
    }
    const shape = new Konva.Rect({
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      fill: 'rgba(120, 170, 220, 0.08)',
      stroke: 'rgba(120, 170, 220, 0.4)',
      strokeWidth: 0.5,
      name: `zone-${id}`,
    });
    shape.on('click tap', () => callbacks.onClick(id));
    shape.on('mouseenter', () => {
      callbacks.onHoverChange(id);
      shape.fill('rgba(120, 170, 220, 0.2)');
      layer.batchDraw();
    });
    shape.on('mouseleave', () => {
      callbacks.onHoverChange(null);
      shape.fill('rgba(120, 170, 220, 0.08)');
      layer.batchDraw();
    });
    layer.add(shape);
  }
  layer.batchDraw();
}

function collectLeafIds(node: ZoneNode): string[] {
  if (node.kind === 'leaf') {
    return [node.id];
  }
  return [...collectLeafIds(node.first), ...collectLeafIds(node.second)];
}
