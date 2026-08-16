import type { Point, Point3 } from './types';

export type PanelKind = 'outerWall' | 'dividerWall' | 'basePlate' | 'shelf' | 'shelfCleat';

/** Ideal (un-burn-corrected) panel geometry -- the single source consumed by
 * the 2D canvas, the 3D view, and SVG export. Burn correction and inner-corner
 * post-processing are applied only at export time, never here. */
export interface Panel {
  id: string;
  kind: PanelKind;
  materialThickness: number;
  outline: Point[];
  holes: Point[][];
  placement3d?: { origin: Point3; rotationZ: number };
  label?: string;
  sourceIds: string[];
}
