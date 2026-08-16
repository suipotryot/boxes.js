export type NotchShape = 'rect' | 'round';
export type NotchEdgeSide = 'top' | 'bottom';

/** A user-added grip notch, always centered on the wall's length. */
export interface Notch {
  id: string;
  width: number;
  depth: number;
  shape: NotchShape;
  edgeSide: NotchEdgeSide;
}
