import type { Viewport } from '@/stores/uiStore';

/**
 * Computes the scale/offset that fits `contentWidth x contentHeight` (mm) at
 * its largest size inside a `viewportWidth x viewportHeight` (px) area with
 * a fixed margin on every side, centered. Used on project open so the empty
 * box is framed as large as possible before the user starts zooming/panning.
 */
export function computeFitToView(
  contentWidth: number,
  contentHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  marginPx: number,
): Viewport {
  const availableWidth = Math.max(viewportWidth - 2 * marginPx, 1);
  const availableHeight = Math.max(viewportHeight - 2 * marginPx, 1);
  const scale = Math.min(availableWidth / contentWidth, availableHeight / contentHeight);
  const offsetX = (viewportWidth - contentWidth * scale) / 2;
  const offsetY = (viewportHeight - contentHeight * scale) / 2;
  return { scale, offsetX, offsetY };
}

const MIN_SCALE = 0.05;
const MAX_SCALE = 20;

/**
 * Applies a wheel-zoom step centered on the cursor: `pointer` stays at the
 * same content-space position before and after the scale change.
 */
export function zoomAtPoint(viewport: Viewport, pointer: { x: number; y: number }, factor: number): Viewport {
  const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, viewport.scale * factor));
  const contentX = (pointer.x - viewport.offsetX) / viewport.scale;
  const contentY = (pointer.y - viewport.offsetY) / viewport.scale;
  return {
    scale: newScale,
    offsetX: pointer.x - contentX * newScale,
    offsetY: pointer.y - contentY * newScale,
  };
}
