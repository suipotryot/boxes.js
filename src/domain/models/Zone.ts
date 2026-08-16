import type { Axis } from './types';
import type { Notch } from './Notch';

export interface ZoneLeaf {
  kind: 'leaf';
  id: string;
}

export interface ZoneSplit {
  kind: 'split';
  id: string;
  axis: Axis;
  /** Usable size of the first (left/top) child, in mm. */
  firstSize: number;
  /** This split creates exactly one divider wall -> one color -> one height. */
  dividerColorId: string;
  notches: Notch[];
  first: ZoneNode;
  second: ZoneNode;
}

export type ZoneNode = ZoneLeaf | ZoneSplit;
