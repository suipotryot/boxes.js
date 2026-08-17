import type { Notch } from '../models/Notch';
import type { Axis, Rect } from '../models/types';
import type { DividerGrid, GridLine, LineNeighborRef, SegmentOverride } from '../models/Grid';
import { createId } from './GeometryUtils';

/**
 * A grid line always spans the full box on its own axis, so the list of
 * crossing points along ANY line of a given axis is identical -- it only
 * depends on the sorted positions of the lines on the OTHER axis (plus the
 * two box edges). This is what makes segment computation a pure function of
 * "all lines of the perpendicular axis", never a tree walk.
 */
export interface AxisBoundary {
  ref: LineNeighborRef;
  offsetMm: number;
}

export function computeAxisBoundaries(lines: GridLine[], lineAxis: Axis, innerRect: Rect): AxisBoundary[] {
  const spanMm = lengthSpanMm(lineAxis, innerRect);
  const crossingAxis: Axis = lineAxis === 'x' ? 'y' : 'x';
  const crossingLines = lines
    .filter((l) => l.axis === crossingAxis)
    .slice()
    .sort((a, b) => a.positionMm - b.positionMm);
  return [
    { ref: { kind: 'edge', side: 'start' }, offsetMm: 0 },
    ...crossingLines.map((l) => ({ ref: { kind: 'line', lineId: l.id } as LineNeighborRef, offsetMm: l.positionMm })),
    { ref: { kind: 'edge', side: 'end' }, offsetMm: spanMm },
  ];
}

export interface ResolvedSegment {
  start: LineNeighborRef;
  end: LineNeighborRef;
  startMm: number;
  endMm: number;
  removed: boolean;
  colorId: string;
  notches: Notch[];
}

/** The ordered list of a line's segments, each resolved against its
 * override (if any) or the line's own defaults. */
export function computeLineSegments(line: GridLine, allLines: GridLine[], innerRect: Rect): ResolvedSegment[] {
  const boundaries = computeAxisBoundaries(allLines, line.axis, innerRect);
  const segments: ResolvedSegment[] = [];
  for (let i = 0; i < boundaries.length - 1; i++) {
    const start = boundaries[i]!;
    const end = boundaries[i + 1]!;
    const override = line.segmentOverrides.find((o) => neighborRefEqual(o.start, start.ref) && neighborRefEqual(o.end, end.ref));
    segments.push({
      start: start.ref,
      end: end.ref,
      startMm: start.offsetMm,
      endMm: end.offsetMm,
      removed: override?.removed ?? false,
      colorId: override?.colorId ?? line.colorId,
      notches: override?.notches ?? [],
    });
  }
  return segments;
}

export function neighborRefEqual(a: LineNeighborRef, b: LineNeighborRef): boolean {
  if (a.kind !== b.kind) {
    return false;
  }
  return a.kind === 'edge' ? a.side === (b as { kind: 'edge'; side: 'start' | 'end' }).side : a.lineId === (b as { kind: 'line'; lineId: string }).lineId;
}

/** mm span along which a line of this axis can be positioned/moved
 * (perpendicular to the line itself). */
function positionSpanMm(axis: Axis, innerRect: Rect): number {
  return axis === 'x' ? innerRect.width : innerRect.height;
}

/** mm span along a line's own length (used to bound its segments). */
function lengthSpanMm(axis: Axis, innerRect: Rect): number {
  return axis === 'x' ? innerRect.height : innerRect.width;
}

/**
 * Doubles as the minimum usable segment length AND the minimum spacing
 * between two lines of the same axis -- enforcing the latter is what
 * guarantees two parallel lines can never swap relative order, which is
 * exactly what keeps neighbour-pair segment identity well-defined.
 */
export const MIN_GRID_SPACING_MM = 1;

export function computeLineMoveBounds(lines: GridLine[], lineId: string, innerRect: Rect): { min: number; max: number } {
  const line = lines.find((l) => l.id === lineId);
  if (!line) {
    throw new Error(`Unknown line ${lineId}`);
  }
  const spanMm = positionSpanMm(line.axis, innerRect);
  const sameAxis = lines
    .filter((l) => l.axis === line.axis && l.id !== lineId)
    .slice()
    .sort((a, b) => a.positionMm - b.positionMm);
  const prev = [...sameAxis].reverse().find((l) => l.positionMm < line.positionMm);
  const next = sameAxis.find((l) => l.positionMm > line.positionMm);
  return {
    min: (prev?.positionMm ?? 0) + MIN_GRID_SPACING_MM,
    max: (next?.positionMm ?? spanMm) - MIN_GRID_SPACING_MM,
  };
}

export function canMoveLineTo(lines: GridLine[], lineId: string, newPositionMm: number, innerRect: Rect): boolean {
  const { min, max } = computeLineMoveBounds(lines, lineId, innerRect);
  return newPositionMm >= min && newPositionMm <= max;
}

export function canAddLine(lines: GridLine[], axis: Axis, positionMm: number, innerRect: Rect): boolean {
  const spanMm = positionSpanMm(axis, innerRect);
  if (positionMm < MIN_GRID_SPACING_MM || positionMm > spanMm - MIN_GRID_SPACING_MM) {
    return false;
  }
  return lines.filter((l) => l.axis === axis).every((l) => Math.abs(l.positionMm - positionMm) >= MIN_GRID_SPACING_MM);
}

/**
 * Adds a new line, then for every EXISTING line of the perpendicular axis,
 * splits the one segment the new line now cuts through into two, both
 * inheriting the original segment's customization verbatim (per the user's
 * explicit decision: never silently reset a removed/recolored portion).
 * Note this can touch N existing lines' overrides at once (every line of
 * the perpendicular axis), unlike the old tree model where a split only
 * ever affected one branch.
 */
export function addLine(grid: DividerGrid, axis: Axis, positionMm: number, colorId: string, innerRect: Rect): DividerGrid {
  const newLine: GridLine = { id: createId('line'), axis, positionMm, colorId, segmentOverrides: [] };
  const perpendicularAxis: Axis = axis === 'x' ? 'y' : 'x';
  const updatedLines = grid.lines.map((line) =>
    line.axis !== perpendicularAxis ? line : { ...line, segmentOverrides: splitOverridesForNewCrossing(line, newLine, grid.lines, innerRect) },
  );
  return { lines: [...updatedLines, newLine] };
}

function splitOverridesForNewCrossing(line: GridLine, newLine: GridLine, allLinesBefore: GridLine[], innerRect: Rect): SegmentOverride[] {
  const segments = computeLineSegments(line, allLinesBefore, innerRect); // resolved BEFORE newLine exists
  const hit = segments.find((s) => newLine.positionMm > s.startMm && newLine.positionMm < s.endMm);
  if (!hit) {
    return line.segmentOverrides; // shouldn't happen if canAddLine was respected, but a no-op is the safe fallback
  }
  const original = line.segmentOverrides.find((o) => neighborRefEqual(o.start, hit.start) && neighborRefEqual(o.end, hit.end));
  if (!original) {
    return line.segmentOverrides; // the hit segment was already at its default, nothing to propagate
  }
  const newRef: LineNeighborRef = { kind: 'line', lineId: newLine.id };
  const withoutOriginal = line.segmentOverrides.filter((o) => o !== original);
  return [
    ...withoutOriginal,
    { ...original, id: createId('segOverride'), start: hit.start, end: newRef },
    { ...original, id: createId('segOverride'), start: newRef, end: hit.end },
  ];
}

/**
 * Removes a line, then for every remaining line of the perpendicular axis,
 * merges the two segments that used to sit on either side of the removed
 * crossing back into one. Per the user's decision: the merged result stays
 * `removed` if either side was, otherwise keeps the longer side's color;
 * notches are always dropped (their geometry no longer fits the new span).
 */
export function removeLine(grid: DividerGrid, lineId: string, innerRect: Rect): DividerGrid {
  const removedLine = grid.lines.find((l) => l.id === lineId);
  if (!removedLine) {
    return grid;
  }
  const perpendicularAxis: Axis = removedLine.axis === 'x' ? 'y' : 'x';
  const updatedLines = grid.lines
    .filter((l) => l.id !== lineId)
    .map((line) =>
      line.axis !== perpendicularAxis ? line : { ...line, segmentOverrides: mergeOverridesForRemovedCrossing(line, removedLine, grid.lines, innerRect) },
    );
  return { lines: updatedLines };
}

function mergeOverridesForRemovedCrossing(line: GridLine, removedLine: GridLine, allLinesBefore: GridLine[], innerRect: Rect): SegmentOverride[] {
  const segments = computeLineSegments(line, allLinesBefore, innerRect); // resolved while removedLine is still a boundary
  const removedRef: LineNeighborRef = { kind: 'line', lineId: removedLine.id };
  const left = segments.find((s) => neighborRefEqual(s.end, removedRef));
  const right = segments.find((s) => neighborRefEqual(s.start, removedRef));
  if (!left || !right) {
    return line.segmentOverrides;
  }
  const merged = resolveMergedCustomization(left, right);
  const withoutBoth = line.segmentOverrides.filter(
    (o) => !(neighborRefEqual(o.start, left.start) && neighborRefEqual(o.end, left.end)) && !(neighborRefEqual(o.start, right.start) && neighborRefEqual(o.end, right.end)),
  );
  const isDefault = !merged.removed && merged.colorId === line.colorId && merged.notches.length === 0;
  if (isDefault) {
    return withoutBoth;
  }
  return [
    ...withoutBoth,
    {
      id: createId('segOverride'),
      start: left.start,
      end: right.end,
      removed: merged.removed,
      colorId: merged.colorId === line.colorId ? null : merged.colorId,
      notches: merged.notches,
    },
  ];
}

function resolveMergedCustomization(left: ResolvedSegment, right: ResolvedSegment): { removed: boolean; colorId: string; notches: Notch[] } {
  if (left.removed || right.removed) {
    return { removed: true, colorId: left.colorId, notches: [] };
  }
  const leftLenMm = left.endMm - left.startMm;
  const rightLenMm = right.endMm - right.startMm;
  const colorId = leftLenMm >= rightLenMm ? left.colorId : right.colorId;
  return { removed: false, colorId, notches: [] };
}

/** Moves a line along its own axis. Never touches any segmentOverrides --
 * they're indexed by line id, never by mm position, so they stay valid. */
export function moveLine(grid: DividerGrid, lineId: string, newPositionMm: number): DividerGrid {
  return { lines: grid.lines.map((l) => (l.id === lineId ? { ...l, positionMm: newPositionMm } : l)) };
}

function resolveOverride(line: GridLine, start: LineNeighborRef, end: LineNeighborRef): SegmentOverride {
  return (
    line.segmentOverrides.find((o) => neighborRefEqual(o.start, start) && neighborRefEqual(o.end, end)) ?? {
      id: createId('segOverride'),
      start,
      end,
      removed: false,
      colorId: null,
      notches: [],
    }
  );
}

function withOverride(grid: DividerGrid, lineId: string, start: LineNeighborRef, end: LineNeighborRef, next: SegmentOverride): DividerGrid {
  const isDefault = !next.removed && next.colorId === null && next.notches.length === 0;
  return {
    lines: grid.lines.map((line) => {
      if (line.id !== lineId) {
        return line;
      }
      const others = line.segmentOverrides.filter((o) => !(neighborRefEqual(o.start, start) && neighborRefEqual(o.end, end)));
      return { ...line, segmentOverrides: isDefault ? others : [...others, next] };
    }),
  };
}

export function setSegmentRemoved(grid: DividerGrid, lineId: string, start: LineNeighborRef, end: LineNeighborRef, removed: boolean): DividerGrid {
  const line = grid.lines.find((l) => l.id === lineId);
  if (!line) {
    return grid;
  }
  return withOverride(grid, lineId, start, end, { ...resolveOverride(line, start, end), removed });
}

export function setSegmentColor(grid: DividerGrid, lineId: string, start: LineNeighborRef, end: LineNeighborRef, colorId: string | null): DividerGrid {
  const line = grid.lines.find((l) => l.id === lineId);
  if (!line) {
    return grid;
  }
  return withOverride(grid, lineId, start, end, { ...resolveOverride(line, start, end), colorId });
}

export function addSegmentNotch(grid: DividerGrid, lineId: string, start: LineNeighborRef, end: LineNeighborRef, notch: Notch): DividerGrid {
  const line = grid.lines.find((l) => l.id === lineId);
  if (!line) {
    return grid;
  }
  const current = resolveOverride(line, start, end);
  return withOverride(grid, lineId, start, end, { ...current, notches: [...current.notches, notch] });
}

export function removeSegmentNotch(grid: DividerGrid, lineId: string, start: LineNeighborRef, end: LineNeighborRef, notchId: string): DividerGrid {
  const line = grid.lines.find((l) => l.id === lineId);
  if (!line) {
    return grid;
  }
  const current = resolveOverride(line, start, end);
  return withOverride(grid, lineId, start, end, { ...current, notches: current.notches.filter((n) => n.id !== notchId) });
}

const DIVIDER_PREFIX = 'divider-';
const REF_SEP = '::';

/** Deterministic WallSegment id for one segment -- encodes the carrying
 * line's id and the segment's neighbour-pair identity, so EdgeEditDialog
 * can recover both the line and the exact clicked segment from a wall id
 * alone (replaces the old `divider-${splitId}` prefix convention). */
export function segmentWallId(lineId: string, start: LineNeighborRef, end: LineNeighborRef): string {
  return `${DIVIDER_PREFIX}${lineId}${REF_SEP}${neighborRefKey(start)}${REF_SEP}${neighborRefKey(end)}`;
}

export function parseDividerWallId(wallId: string): { lineId: string; start: LineNeighborRef; end: LineNeighborRef } | null {
  if (!wallId.startsWith(DIVIDER_PREFIX)) {
    return null;
  }
  const [lineId, startKey, endKey] = wallId.slice(DIVIDER_PREFIX.length).split(REF_SEP);
  if (!lineId || !startKey || !endKey) {
    return null;
  }
  return { lineId, start: parseNeighborRefKey(startKey), end: parseNeighborRefKey(endKey) };
}

function neighborRefKey(ref: LineNeighborRef): string {
  return ref.kind === 'edge' ? `edge:${ref.side}` : `line:${ref.lineId}`;
}

function parseNeighborRefKey(key: string): LineNeighborRef {
  if (key.startsWith('edge:')) {
    return { kind: 'edge', side: key.slice(5) as 'start' | 'end' };
  }
  return { kind: 'line', lineId: key.slice(5) };
}
