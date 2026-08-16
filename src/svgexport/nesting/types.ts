import type { Panel } from '@/domain/models/Panel';
import type { Rect } from '@/domain/models/types';

export interface PlacedRect extends Rect {
  rotated: boolean;
}

export interface PlacedPanel {
  panel: Panel;
  x: number;
  y: number;
  rotated: boolean;
}
