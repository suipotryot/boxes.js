export interface Point {
  x: number;
  y: number;
}

export interface Point3 {
  x: number;
  y: number;
  z: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 'x': children are split left/right by a vertical cut line.
 *  'y': children are split top/bottom by a horizontal cut line. */
export type Axis = 'x' | 'y';
