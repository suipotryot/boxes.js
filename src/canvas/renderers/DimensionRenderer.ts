import Konva from 'konva';

import type { WallSegment } from '@/domain/models/WallSegment';

/** Draws a length label at the midpoint of every wall, on the togglable dimension layer. */
export function renderDimensions(layer: Konva.Layer, walls: WallSegment[], scale: number): void {
  layer.destroyChildren();
  const fontSize = Math.max(3 / scale, 2);

  for (const wall of walls) {
    const length = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y);
    const midX = (wall.a.x + wall.b.x) / 2;
    const midY = (wall.a.y + wall.b.y) / 2;
    const label = new Konva.Text({
      x: midX,
      y: midY,
      text: `${length.toFixed(0)} mm`,
      fontSize,
      fill: '#e8e8e8',
      offsetX: 0,
      offsetY: fontSize / 2,
    });
    label.offsetX(label.width() / 2);
    layer.add(label);
  }
  layer.batchDraw();
}
