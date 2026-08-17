import { describe, expect, it } from 'vitest';

import type { DividerGrid, GridLine, LineNeighborRef } from '../models/Grid';
import {
  addLine,
  addSegmentNotch,
  canAddLine,
  canMoveLineTo,
  computeAxisBoundaries,
  computeLineMoveBounds,
  computeLineSegments,
  moveLine,
  neighborRefEqual,
  parseDividerWallId,
  removeLine,
  removeSegmentNotch,
  segmentWallId,
  setSegmentColor,
  setSegmentRemoved,
} from '../services/GridDivider';

const innerRect = { x: 0, y: 0, width: 100, height: 80 };

const edgeStart: LineNeighborRef = { kind: 'edge', side: 'start' };
const edgeEnd: LineNeighborRef = { kind: 'edge', side: 'end' };
const lineRef = (id: string): LineNeighborRef => ({ kind: 'line', lineId: id });

const vLine = (overrides: Partial<GridLine> = {}): GridLine => ({
  id: 'v1',
  axis: 'x',
  positionMm: 40,
  colorId: 'red',
  segmentOverrides: [],
  ...overrides,
});

const hLine = (overrides: Partial<GridLine> = {}): GridLine => ({
  id: 'h1',
  axis: 'y',
  positionMm: 30,
  colorId: 'blue',
  segmentOverrides: [],
  ...overrides,
});

describe('computeAxisBoundaries', () => {
  it('returns just the two box edges when no perpendicular lines exist', () => {
    const boundaries = computeAxisBoundaries([], 'x', innerRect);
    expect(boundaries).toEqual([
      { ref: edgeStart, offsetMm: 0 },
      { ref: edgeEnd, offsetMm: 80 }, // 'x' lines span the inner HEIGHT
    ]);
  });

  it('is identical for every line of a given axis -- depends only on the perpendicular axis', () => {
    const lines = [vLine({ id: 'v1', positionMm: 10 }), vLine({ id: 'v2', positionMm: 70 }), hLine({ id: 'h1', positionMm: 30 })];
    const boundaries = computeAxisBoundaries(lines, 'x', innerRect);
    expect(boundaries).toEqual([
      { ref: edgeStart, offsetMm: 0 },
      { ref: lineRef('h1'), offsetMm: 30 },
      { ref: edgeEnd, offsetMm: 80 },
    ]);
  });

  it('sorts multiple perpendicular lines by position', () => {
    const lines = [hLine({ id: 'h2', positionMm: 60 }), hLine({ id: 'h1', positionMm: 20 })];
    const boundaries = computeAxisBoundaries(lines, 'x', innerRect);
    expect(boundaries.map((b) => b.ref)).toEqual([edgeStart, lineRef('h1'), lineRef('h2'), edgeEnd]);
  });

  it('uses the inner width as span for a horizontal (y-axis) line', () => {
    const boundaries = computeAxisBoundaries([], 'y', innerRect);
    expect(boundaries).toEqual([
      { ref: edgeStart, offsetMm: 0 },
      { ref: edgeEnd, offsetMm: 100 },
    ]);
  });
});

describe('computeLineSegments', () => {
  it('a line with no crossings has exactly one segment at its own default color', () => {
    const line = vLine();
    const segments = computeLineSegments(line, [line], innerRect);
    expect(segments).toEqual([{ start: edgeStart, end: edgeEnd, startMm: 0, endMm: 80, removed: false, colorId: 'red', notches: [] }]);
  });

  it('splits into segments at every perpendicular crossing, defaults inherited from the line', () => {
    const line = vLine();
    const cross = hLine({ positionMm: 30 });
    const segments = computeLineSegments(line, [line, cross], innerRect);
    expect(segments).toEqual([
      { start: edgeStart, end: lineRef('h1'), startMm: 0, endMm: 30, removed: false, colorId: 'red', notches: [] },
      { start: lineRef('h1'), end: edgeEnd, startMm: 30, endMm: 80, removed: false, colorId: 'red', notches: [] },
    ]);
  });

  it('resolves a matching override instead of the line default', () => {
    const line = vLine({
      segmentOverrides: [{ id: 'o1', start: edgeStart, end: lineRef('h1'), removed: true, colorId: null, notches: [] }],
    });
    const cross = hLine({ positionMm: 30 });
    const segments = computeLineSegments(line, [line, cross], innerRect);
    expect(segments[0]).toMatchObject({ removed: true, colorId: 'red' }); // colorId still inherits since override.colorId is null
    expect(segments[1]).toMatchObject({ removed: false, colorId: 'red' });
  });

  it('an override colorId overrides the line default', () => {
    const line = vLine({
      segmentOverrides: [{ id: 'o1', start: edgeStart, end: edgeEnd, removed: false, colorId: 'green', notches: [] }],
    });
    const segments = computeLineSegments(line, [line], innerRect);
    expect(segments[0]!.colorId).toBe('green');
  });
});

describe('canAddLine / canMoveLineTo', () => {
  it('rejects a position closer than MIN_GRID_SPACING_MM to either box edge', () => {
    expect(canAddLine([], 'x', 0, innerRect)).toBe(false);
    expect(canAddLine([], 'x', 0.5, innerRect)).toBe(false);
    expect(canAddLine([], 'x', 1, innerRect)).toBe(true);
    expect(canAddLine([], 'x', 99, innerRect)).toBe(true);
    expect(canAddLine([], 'x', 99.5, innerRect)).toBe(false);
  });

  it('rejects a position too close to an existing line of the SAME axis', () => {
    const lines = [vLine({ positionMm: 50 })];
    expect(canAddLine(lines, 'x', 50, innerRect)).toBe(false);
    expect(canAddLine(lines, 'x', 50.5, innerRect)).toBe(false);
    expect(canAddLine(lines, 'x', 51, innerRect)).toBe(true);
  });

  it('ignores lines of the perpendicular axis entirely for spacing', () => {
    const lines = [hLine({ positionMm: 50 })];
    expect(canAddLine(lines, 'x', 50, innerRect)).toBe(true);
  });

  it('computeLineMoveBounds clamps between the nearest same-axis neighbours', () => {
    const lines = [vLine({ id: 'v1', positionMm: 20 }), vLine({ id: 'v2', positionMm: 50 }), vLine({ id: 'v3', positionMm: 80 })];
    expect(computeLineMoveBounds(lines, 'v2', innerRect)).toEqual({ min: 21, max: 79 });
    expect(computeLineMoveBounds(lines, 'v1', innerRect)).toEqual({ min: 1, max: 49 });
    expect(computeLineMoveBounds(lines, 'v3', innerRect)).toEqual({ min: 51, max: 99 });
  });

  it('canMoveLineTo rejects a move that would cross a same-axis neighbour', () => {
    const lines = [vLine({ id: 'v1', positionMm: 20 }), vLine({ id: 'v2', positionMm: 50 })];
    expect(canMoveLineTo(lines, 'v1', 49, innerRect)).toBe(true);
    expect(canMoveLineTo(lines, 'v1', 50, innerRect)).toBe(false);
    expect(canMoveLineTo(lines, 'v1', 51, innerRect)).toBe(false);
  });
});

describe('addLine', () => {
  it('adds a fresh line with no overrides', () => {
    const grid: DividerGrid = { lines: [] };
    const result = addLine(grid, 'x', 40, 'red', innerRect);
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]).toMatchObject({ axis: 'x', positionMm: 40, colorId: 'red', segmentOverrides: [] });
  });

  it('does not touch a same-axis line -- only perpendicular lines can be crossed', () => {
    const grid: DividerGrid = { lines: [vLine({ id: 'v1', positionMm: 10, segmentOverrides: [{ id: 'o', start: edgeStart, end: edgeEnd, removed: true, colorId: null, notches: [] }] })] };
    const result = addLine(grid, 'x', 60, 'green', innerRect);
    const untouched = result.lines.find((l) => l.id === 'v1')!;
    expect(untouched.segmentOverrides).toEqual(grid.lines[0]!.segmentOverrides);
  });

  it('CENTRAL CASE: splits a removed segment in two, both halves staying removed', () => {
    const v = vLine({ id: 'v1', segmentOverrides: [{ id: 'o1', start: edgeStart, end: edgeEnd, removed: true, colorId: null, notches: [] }] });
    const grid: DividerGrid = { lines: [v] };
    const result = addLine(grid, 'y', 30, 'blue', innerRect);
    const newLineId = result.lines.find((l) => l.axis === 'y')!.id;
    const updatedV = result.lines.find((l) => l.id === 'v1')!;
    expect(updatedV.segmentOverrides).toHaveLength(2);
    expect(updatedV.segmentOverrides.every((o) => o.removed === true)).toBe(true);
    const segments = computeLineSegments(updatedV, result.lines, innerRect);
    expect(segments).toEqual([
      { start: edgeStart, end: lineRef(newLineId), startMm: 0, endMm: 30, removed: true, colorId: 'red', notches: [] },
      { start: lineRef(newLineId), end: edgeEnd, startMm: 30, endMm: 80, removed: true, colorId: 'red', notches: [] },
    ]);
  });

  it('CENTRAL CASE: splits a recolored segment in two, both halves keeping the color', () => {
    const v = vLine({ id: 'v1', segmentOverrides: [{ id: 'o1', start: edgeStart, end: edgeEnd, removed: false, colorId: 'purple', notches: [] }] });
    const grid: DividerGrid = { lines: [v] };
    const result = addLine(grid, 'y', 30, 'blue', innerRect);
    const updatedV = result.lines.find((l) => l.id === 'v1')!;
    expect(updatedV.segmentOverrides).toHaveLength(2);
    expect(updatedV.segmentOverrides.every((o) => o.colorId === 'purple')).toBe(true);
  });

  it('leaves an already-default segment alone (no override created just because it was crossed)', () => {
    const v = vLine({ id: 'v1' });
    const grid: DividerGrid = { lines: [v] };
    const result = addLine(grid, 'y', 30, 'blue', innerRect);
    const updatedV = result.lines.find((l) => l.id === 'v1')!;
    expect(updatedV.segmentOverrides).toEqual([]);
  });

  it('splits overrides on EVERY perpendicular line, not just one', () => {
    const v1 = vLine({ id: 'v1', positionMm: 10, segmentOverrides: [{ id: 'o1', start: edgeStart, end: edgeEnd, removed: true, colorId: null, notches: [] }] });
    const v2 = vLine({ id: 'v2', positionMm: 60, segmentOverrides: [{ id: 'o2', start: edgeStart, end: edgeEnd, removed: true, colorId: null, notches: [] }] });
    const grid: DividerGrid = { lines: [v1, v2] };
    const result = addLine(grid, 'y', 30, 'blue', innerRect);
    expect(result.lines.find((l) => l.id === 'v1')!.segmentOverrides).toHaveLength(2);
    expect(result.lines.find((l) => l.id === 'v2')!.segmentOverrides).toHaveLength(2);
  });
});

describe('removeLine', () => {
  it('is a no-op when the line id is unknown', () => {
    const grid: DividerGrid = { lines: [vLine()] };
    expect(removeLine(grid, 'nonexistent', innerRect)).toEqual(grid);
  });

  it('merges two default segments back into nothing (still default)', () => {
    const v = vLine({ id: 'v1' });
    const h = hLine({ id: 'h1', positionMm: 30 });
    const result = removeLine({ lines: [v, h] }, 'h1', innerRect);
    const updatedV = result.lines.find((l) => l.id === 'v1')!;
    expect(updatedV.segmentOverrides).toEqual([]);
  });

  it('LONGEST WINS: merged segment keeps the color of the longer side', () => {
    // h1 at y=30 -> left segment [0,30) length 30, right segment [30,80) length 50.
    const v = vLine({
      id: 'v1',
      segmentOverrides: [
        { id: 'oLeft', start: edgeStart, end: lineRef('h1'), removed: false, colorId: 'green', notches: [] },
        { id: 'oRight', start: lineRef('h1'), end: edgeEnd, removed: false, colorId: 'yellow', notches: [] },
      ],
    });
    const h = hLine({ id: 'h1', positionMm: 30 });
    const result = removeLine({ lines: [v, h] }, 'h1', innerRect);
    const updatedV = result.lines.find((l) => l.id === 'v1')!;
    expect(updatedV.segmentOverrides).toEqual([{ id: expect.any(String), start: edgeStart, end: edgeEnd, removed: false, colorId: 'yellow', notches: [] }]);
  });

  it('TIE-BREAK: equal-length sides keep the start (left/top) side color', () => {
    // h1 at y=40 -> both sides length 40.
    const v = vLine({
      id: 'v1',
      segmentOverrides: [
        { id: 'oLeft', start: edgeStart, end: lineRef('h1'), removed: false, colorId: 'green', notches: [] },
        { id: 'oRight', start: lineRef('h1'), end: edgeEnd, removed: false, colorId: 'yellow', notches: [] },
      ],
    });
    const h = hLine({ id: 'h1', positionMm: 40 });
    const result = removeLine({ lines: [v, h] }, 'h1', innerRect);
    expect(result.lines.find((l) => l.id === 'v1')!.segmentOverrides[0]!.colorId).toBe('green');
  });

  it('REMOVED WINS: merged segment stays removed if either side was removed, regardless of length', () => {
    const v = vLine({
      id: 'v1',
      segmentOverrides: [
        { id: 'oLeft', start: edgeStart, end: lineRef('h1'), removed: false, colorId: 'green', notches: [] },
        { id: 'oRight', start: lineRef('h1'), end: edgeEnd, removed: true, colorId: null, notches: [] },
      ],
    });
    const h = hLine({ id: 'h1', positionMm: 30 });
    const result = removeLine({ lines: [v, h] }, 'h1', innerRect);
    expect(result.lines.find((l) => l.id === 'v1')!.segmentOverrides[0]).toMatchObject({ removed: true });
  });

  it('drops notches on merge -- they no longer fit the new combined span', () => {
    const v = vLine({
      id: 'v1',
      segmentOverrides: [
        { id: 'oLeft', start: edgeStart, end: lineRef('h1'), removed: false, colorId: 'purple', notches: [{ id: 'n1', width: 10, depth: 5, shape: 'rect', edgeSide: 'top' }] },
        { id: 'oRight', start: lineRef('h1'), end: edgeEnd, removed: false, colorId: 'purple', notches: [] },
      ],
    });
    const h = hLine({ id: 'h1', positionMm: 30 });
    const result = removeLine({ lines: [v, h] }, 'h1', innerRect);
    const overrides = result.lines.find((l) => l.id === 'v1')!.segmentOverrides;
    // Non-default color survives the merge, but its notches are gone.
    expect(overrides).toEqual([{ id: expect.any(String), start: edgeStart, end: edgeEnd, removed: false, colorId: 'purple', notches: [] }]);
  });
});

describe('moveLine', () => {
  it('updates only positionMm, leaving segmentOverrides untouched', () => {
    const v = vLine({ id: 'v1', positionMm: 40, segmentOverrides: [{ id: 'o1', start: edgeStart, end: edgeEnd, removed: true, colorId: null, notches: [] }] });
    const result = moveLine({ lines: [v] }, 'v1', 55);
    const updated = result.lines[0]!;
    expect(updated.positionMm).toBe(55);
    expect(updated.segmentOverrides).toEqual(v.segmentOverrides);
  });

  it('is a no-op when the line id is unknown', () => {
    const grid: DividerGrid = { lines: [vLine()] };
    expect(moveLine(grid, 'nonexistent', 55)).toEqual(grid);
  });
});

describe('setSegmentRemoved / setSegmentColor', () => {
  it('creates an override when marking a default segment removed', () => {
    const grid: DividerGrid = { lines: [vLine({ id: 'v1' })] };
    const result = setSegmentRemoved(grid, 'v1', edgeStart, edgeEnd, true);
    expect(result.lines[0]!.segmentOverrides).toEqual([{ id: expect.any(String), start: edgeStart, end: edgeEnd, removed: true, colorId: null, notches: [] }]);
  });

  it('collapses an override back to nothing once it returns to all-default values', () => {
    const grid: DividerGrid = { lines: [vLine({ id: 'v1' })] };
    const removed = setSegmentRemoved(grid, 'v1', edgeStart, edgeEnd, true);
    const restored = setSegmentRemoved(removed, 'v1', edgeStart, edgeEnd, false);
    expect(restored.lines[0]!.segmentOverrides).toEqual([]);
  });

  it('setSegmentColor is independent of removed state', () => {
    const grid: DividerGrid = { lines: [vLine({ id: 'v1' })] };
    const result = setSegmentColor(grid, 'v1', edgeStart, edgeEnd, 'green');
    expect(result.lines[0]!.segmentOverrides[0]).toMatchObject({ removed: false, colorId: 'green' });
  });
});

describe('addSegmentNotch / removeSegmentNotch', () => {
  it('adds a notch to a fresh override and removes it back to default', () => {
    const grid: DividerGrid = { lines: [vLine({ id: 'v1' })] };
    const withNotch = addSegmentNotch(grid, 'v1', edgeStart, edgeEnd, { id: 'n1', width: 10, depth: 5, shape: 'rect', edgeSide: 'top' });
    expect(withNotch.lines[0]!.segmentOverrides[0]!.notches).toHaveLength(1);
    const withoutNotch = removeSegmentNotch(withNotch, 'v1', edgeStart, edgeEnd, 'n1');
    expect(withoutNotch.lines[0]!.segmentOverrides).toEqual([]);
  });
});

describe('neighborRefEqual', () => {
  it('distinguishes edge sides and different line ids', () => {
    expect(neighborRefEqual(edgeStart, edgeStart)).toBe(true);
    expect(neighborRefEqual(edgeStart, edgeEnd)).toBe(false);
    expect(neighborRefEqual(lineRef('a'), lineRef('a'))).toBe(true);
    expect(neighborRefEqual(lineRef('a'), lineRef('b'))).toBe(false);
    expect(neighborRefEqual(edgeStart, lineRef('a'))).toBe(false);
  });
});

describe('segmentWallId / parseDividerWallId', () => {
  it('round-trips an edge-to-edge segment', () => {
    const id = segmentWallId('v1', edgeStart, edgeEnd);
    expect(parseDividerWallId(id)).toEqual({ lineId: 'v1', start: edgeStart, end: edgeEnd });
  });

  it('round-trips a segment bounded by other lines', () => {
    const id = segmentWallId('v1', lineRef('h1'), lineRef('h2'));
    expect(parseDividerWallId(id)).toEqual({ lineId: 'v1', start: lineRef('h1'), end: lineRef('h2') });
  });

  it('returns null for a non-divider wall id (e.g. an outer wall)', () => {
    expect(parseDividerWallId('outer-west')).toBeNull();
  });
});
