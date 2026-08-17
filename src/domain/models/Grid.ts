import type { Axis } from './types';
import type { Notch } from './Notch';

/**
 * Stable reference to one of the two boundaries a segment sits between,
 * along its carrying line. Deliberately NOT an index or an mm coordinate:
 * an index shifts silently when a perpendicular line is inserted elsewhere
 * on the grid, and an mm coordinate shifts whenever a neighbouring line
 * moves. A line's own `id` never changes once created, wherever it
 * currently sits -- so a pair of neighbour refs stays valid across every
 * grid edit except one that actually adds/removes the crossing itself,
 * which is exactly the one case where the identity of a segment SHOULD
 * change (see GridDivider.ts).
 */
export type LineNeighborRef =
  | { kind: 'edge'; side: 'start' | 'end' }
  | { kind: 'line'; lineId: string };

/**
 * A user customization of one segment (the portion of a line between two
 * consecutive crossings). Keyed by its `start`/`end` neighbour pair, not by
 * position in an array. A segment absent from `GridLine.segmentOverrides`
 * is implicitly "present, carrying line's default color, no notches".
 */
export interface SegmentOverride {
  /** Stable key for UI list rendering / notch CRUD -- never used for
   * segment identity matching, that's what start/end are for. */
  id: string;
  start: LineNeighborRef;
  end: LineNeighborRef;
  removed: boolean;
  /** null = inherits the carrying line's own default colorId. */
  colorId: string | null;
  notches: Notch[];
}

export interface GridLine {
  id: string;
  /** 'x' = vertical line, spans the full inner height. 'y' = horizontal
   * line, spans the full inner width. Same convention as the old
   * ZoneSplit.axis. */
  axis: Axis;
  /** Offset in mm, from the inner rect's own origin on this axis, to this
   * line's centerline. Thickness is always config.innerThickness (not
   * stored per line, same as before). */
  positionMm: number;
  /** Default color/height for any segment without its own override. */
  colorId: string;
  /** Sparse list: only segments that differ from the line's default. */
  segmentOverrides: SegmentOverride[];
}

export interface DividerGrid {
  lines: GridLine[];
}
