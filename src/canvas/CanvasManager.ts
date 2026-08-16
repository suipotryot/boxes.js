import Konva from 'konva';

import type { Viewport } from '@/stores/uiStore';
import { computeFitToView, zoomAtPoint } from './Viewport';

export interface CanvasManagerOptions {
  container: HTMLDivElement;
  onViewportChange: (viewport: Viewport) => void;
}

/**
 * Owns the Konva.Stage and its layers. Layer order (back to front) matches
 * the plan: background (outer contour) -> zones (split targets) -> walls
 * (edit targets, on top so hit-testing distinguishes "clicked a wall" from
 * "clicked empty zone" natively) -> dimensions (togglable) -> interaction
 * (hover/selection highlight).
 */
export class CanvasManager {
  readonly stage: Konva.Stage;
  readonly backgroundLayer: Konva.Layer;
  readonly zoneLayer: Konva.Layer;
  readonly wallLayer: Konva.Layer;
  readonly dimensionLayer: Konva.Layer;
  readonly interactionLayer: Konva.Layer;

  private readonly onViewportChange: (viewport: Viewport) => void;

  constructor(options: CanvasManagerOptions) {
    this.onViewportChange = options.onViewportChange;
    this.stage = new Konva.Stage({
      container: options.container,
      width: options.container.clientWidth,
      height: options.container.clientHeight,
      draggable: true,
    });

    this.backgroundLayer = new Konva.Layer();
    this.zoneLayer = new Konva.Layer();
    this.wallLayer = new Konva.Layer();
    this.dimensionLayer = new Konva.Layer();
    this.interactionLayer = new Konva.Layer();
    this.stage.add(this.backgroundLayer, this.zoneLayer, this.wallLayer, this.dimensionLayer, this.interactionLayer);

    this.wireZoomPan();
  }

  currentViewport(): Viewport {
    return { scale: this.stage.scaleX(), offsetX: this.stage.x(), offsetY: this.stage.y() };
  }

  setViewport(viewport: Viewport): void {
    this.stage.scale({ x: viewport.scale, y: viewport.scale });
    this.stage.position({ x: viewport.offsetX, y: viewport.offsetY });
  }

  /** Frames `contentWidth x contentHeight` (mm) at its largest size in the
   * current viewport, with `marginPx` of breathing room on every side. */
  fitToView(contentWidth: number, contentHeight: number, marginPx = 40): Viewport {
    const viewport = computeFitToView(contentWidth, contentHeight, this.stage.width(), this.stage.height(), marginPx);
    this.setViewport(viewport);
    this.onViewportChange(viewport);
    return viewport;
  }

  resize(width: number, height: number): void {
    this.stage.width(width);
    this.stage.height(height);
  }

  destroy(): void {
    this.stage.destroy();
  }

  private wireZoomPan(): void {
    this.stage.on('dragend', () => {
      this.onViewportChange(this.currentViewport());
    });
    this.stage.on('wheel', (e) => {
      e.evt.preventDefault();
      const pointer = this.stage.getPointerPosition();
      if (!pointer) return;
      const factor = e.evt.deltaY < 0 ? 1.05 : 1 / 1.05;
      const next = zoomAtPoint(this.currentViewport(), pointer, factor);
      this.setViewport(next);
      this.onViewportChange(next);
    });
  }
}
