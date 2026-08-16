import type { Notch } from './Notch';
import type { Point } from './types';

/** Absolute-coordinate, axis-aligned wall, flattened out of the ZoneNode tree. */
export interface WallSegment {
  id: string;
  a: Point;
  b: Point;
  /** Always ColorHeightRegistry.getHeight(colorId) -- outer walls included. */
  height: number;
  thickness: number;
  isOuter: boolean;
  colorId: string;
  notches: Notch[];
}
