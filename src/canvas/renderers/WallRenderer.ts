import Konva from 'konva';

import type { ColorEntry } from '@/domain/models/ColorHeightRegistry';
import type { WallSegment } from '@/domain/models/WallSegment';

export interface WallRendererCallbacks {
  onClick: (wallId: string) => void;
  onHoverChange: (wallId: string | null) => void;
  /** Called live during a divider wall's drag, in Konva's ABSOLUTE
   * (stage-pixel) space -- that's the contract `dragBoundFunc` itself uses
   * (it receives and must return an absolute position, which Konva then
   * applies via `setAbsolutePosition`), not local/content-mm space. The
   * caller is responsible for converting to/from content-mm (via the
   * current viewport) to do any mm-space axis-locking/clamping. Outer
   * walls are never draggable, so this is only invoked for dividers. */
  onDragBound?: (wallId: string, pos: { x: number; y: number }) => { x: number; y: number };
  /** Called once, on drag release, with the final (already-clamped)
   * absolute (stage-pixel) position -- the one point where the move should
   * actually commit to the store (a single undo/redo step per gesture, not
   * one per frame). */
  onDragEnd?: (wallId: string, pos: { x: number; y: number }) => void;
}

/**
 * Draws each wall as a plan-view strip (its centerline, `thickness` wide),
 * colored by its resolved ColorEntry. This intentionally does not use the
 * finger-jointed Panel.outline from PanelBuilder -- that outline is an
 * *unrolled elevation* (local u/v frame meant for 3D placement and SVG
 * export), not a top-down footprint, so the plan view renders directly from
 * WallSegment instead.
 *
 * Every wall's centerline stops exactly at the point it meets another wall
 * (see WallExtractor), so two strips drawn at their literal centerline
 * length only overlap in a thin sliver near that shared point rather than
 * covering the whole junction square -- at a corner they'd visibly just
 * "touch" instead of overlapping the way a real finger-jointed corner does.
 * `endExtensionMm` (half the project's largest thickness, so it's always
 * enough regardless of what a given end meets) pads every strip past its
 * own centerline endpoint on both ends purely for this visual coverage; it
 * doesn't touch the underlying WallSegment/Panel geometry.
 */
export function renderWalls(
  layer: Konva.Layer,
  walls: WallSegment[],
  colors: ColorEntry[],
  selectedWallId: string | null,
  endExtensionMm: number,
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
    // offsetX = endExtensionMm shifts the strip's start back by the pad
    // amount, and the extra 2x is added to width, extending both ends.
    const shape = new Konva.Rect({
      x: wall.a.x,
      y: wall.a.y,
      offsetX: endExtensionMm,
      offsetY: wall.thickness / 2,
      width: length + 2 * endExtensionMm,
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

    // Only divider walls move; outer walls are fixed. Note: when a line has
    // been split into several segments by crossings, dragging one segment's
    // shape only visually follows the cursor for that shape -- the line's
    // other segments (separate Konva shapes) stay put until the drag
    // commits and the full canvas redraw picks up the new position. A live
    // multi-shape follow is a nice-to-have left for later, not attempted
    // here.
    if (!wall.isOuter && callbacks.onDragBound && callbacks.onDragEnd) {
      shape.draggable(true);
      shape.dragBoundFunc((pos) => callbacks.onDragBound!(wall.id, pos));
      // getAbsolutePosition(), not position() (local) -- dragBoundFunc's
      // return value was applied via setAbsolutePosition, so the shape's
      // LOCAL x/y now equals content-mm directly (this layer has no own
      // transform); reading it back as "local" here would silently skip
      // the pixel<->mm conversion the caller expects to do itself.
      shape.on('dragend', () => callbacks.onDragEnd!(wall.id, shape.getAbsolutePosition()));
    }

    layer.add(shape);
  }
  layer.batchDraw();
}
