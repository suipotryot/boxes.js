import { describe, expect, it } from 'vitest';

import { ColorHeightRegistry } from '../models/ColorHeightRegistry';
import type { DividerGrid, GridLine, LineNeighborRef } from '../models/Grid';
import { extract } from '../services/WallExtractor';

const edgeStart: LineNeighborRef = { kind: 'edge', side: 'start' };
const edgeEnd: LineNeighborRef = { kind: 'edge', side: 'end' };

function makeColors(): ColorHeightRegistry {
  return new ColorHeightRegistry([
    { id: 'outer', color: '#888888', heightMm: 60 },
    { id: 'divider', color: '#ff0000', heightMm: 40 },
  ]);
}

const emptyGrid: DividerGrid = { lines: [] };

describe('WallExtractor.extract', () => {
  it('produces the 4 outer walls (centerline convention) and no dividers for an empty grid', () => {
    const colors = makeColors();
    const walls = extract({
      grid: emptyGrid,
      innerRect: { x: 5, y: 5, width: 100, height: 50 },
      outerThickness: 5,
      innerThickness: 3,
      outerColorId: 'outer',
      colors,
    });

    expect(walls).toHaveLength(4);
    expect(walls.every((w) => w.isOuter)).toBe(true);
    expect(walls.every((w) => w.colorId === 'outer')).toBe(true);
    expect(walls.every((w) => w.height === 60)).toBe(true);
    expect(walls.every((w) => w.thickness === 5)).toBe(true);

    // Centerline rect: inset the inner rect outward by half the outer thickness.
    // innerRect {x:5,y:5,w:100,h:50}, outerThickness 5 -> centerline rect
    // {x: 2.5, y: 2.5, w: 105, h: 55}.
    const west = walls.find((w) => w.a.x === w.b.x && w.a.x === 2.5);
    const east = walls.find((w) => w.a.x === w.b.x && w.a.x === 107.5);
    const north = walls.find((w) => w.a.y === w.b.y && w.a.y === 2.5);
    const south = walls.find((w) => w.a.y === w.b.y && w.a.y === 57.5);

    expect(west).toBeDefined();
    expect(east).toBeDefined();
    expect(north).toBeDefined();
    expect(south).toBeDefined();

    expect([west!.a.y, west!.b.y].sort((a, b) => a - b)).toEqual([2.5, 57.5]);
    expect([north!.a.x, north!.b.x].sort((a, b) => a - b)).toEqual([2.5, 107.5]);
  });

  it('adds one wall segment for a single x-axis (vertical) line spanning the full box', () => {
    const colors = makeColors();
    const line: GridLine = { id: 'v1', axis: 'x', positionMm: 40, colorId: 'divider', segmentOverrides: [] };
    const walls = extract({
      grid: { lines: [line] },
      innerRect: { x: 0, y: 0, width: 100, height: 50 },
      outerThickness: 4,
      innerThickness: 2,
      outerColorId: 'outer',
      colors,
    });

    expect(walls).toHaveLength(5); // 4 outer + 1 divider
    const divider = walls.find((w) => !w.isOuter);
    expect(divider).toBeDefined();
    expect(divider!.colorId).toBe('divider');
    expect(divider!.height).toBe(40);
    expect(divider!.thickness).toBe(2);
    expect(divider!.a.x).toBeCloseTo(40);
    expect(divider!.b.x).toBeCloseTo(40);
    // Single segment, both ends border the box edge -> extended by
    // outerThickness/2 = 2 beyond the raw [0,50] span.
    expect([divider!.a.y, divider!.b.y].sort((a, b) => a - b)).toEqual([-2, 52]);
  });

  it('adds one wall segment for a single y-axis (horizontal) line spanning the full box', () => {
    const colors = makeColors();
    const line: GridLine = { id: 'h1', axis: 'y', positionMm: 20, colorId: 'divider', segmentOverrides: [] };
    const walls = extract({
      grid: { lines: [line] },
      innerRect: { x: 0, y: 0, width: 60, height: 80 },
      outerThickness: 4,
      innerThickness: 4,
      outerColorId: 'outer',
      colors,
    });

    const divider = walls.find((w) => !w.isOuter)!;
    expect(divider.a.y).toBeCloseTo(20);
    expect(divider.b.y).toBeCloseTo(20);
    expect([divider.a.x, divider.b.x].sort((a, b) => a - b)).toEqual([-2, 62]);
  });

  it('produces one wall segment per PRESENT segment, and splits a line at every crossing', () => {
    const colors = makeColors();
    const v: GridLine = { id: 'v1', axis: 'x', positionMm: 40, colorId: 'divider', segmentOverrides: [] };
    const h: GridLine = { id: 'h1', axis: 'y', positionMm: 30, colorId: 'divider', segmentOverrides: [] };
    const walls = extract({
      grid: { lines: [v, h] },
      innerRect: { x: 0, y: 0, width: 100, height: 100 },
      outerThickness: 2,
      innerThickness: 2,
      outerColorId: 'outer',
      colors,
    });

    // v (2 segments, split by h) + h (2 segments, split by v) = 4 divider walls.
    expect(walls.filter((w) => !w.isOuter)).toHaveLength(4);
  });

  it('a removed segment produces NO wall segment -- that is the gap', () => {
    const colors = makeColors();
    const v: GridLine = {
      id: 'v1',
      axis: 'x',
      positionMm: 40,
      colorId: 'divider',
      segmentOverrides: [{ id: 'o1', start: edgeStart, end: edgeEnd, removed: true, colorId: null, notches: [] }],
    };
    const walls = extract({
      grid: { lines: [v] },
      innerRect: { x: 0, y: 0, width: 100, height: 50 },
      outerThickness: 4,
      innerThickness: 2,
      outerColorId: 'outer',
      colors,
    });

    expect(walls.filter((w) => !w.isOuter)).toHaveLength(0);
    expect(walls).toHaveLength(4); // outer walls unaffected
  });

  it('extends a segment bounded by another line exactly to that line centerline, not just the crossing coordinate', () => {
    // Regression equivalent of the old tree-based "reach parent centerline" test:
    // a segment's endpoint must land exactly on the bordering line's own
    // centerline, otherwise JunctionClassifier's exact-point matching misses it.
    const colors = makeColors();
    const v: GridLine = { id: 'v1', axis: 'x', positionMm: 40, colorId: 'divider', segmentOverrides: [] };
    const h: GridLine = { id: 'h1', axis: 'y', positionMm: 20, colorId: 'divider', segmentOverrides: [] };
    const walls = extract({
      grid: { lines: [v, h] },
      innerRect: { x: 0, y: 0, width: 100, height: 50 },
      outerThickness: 2,
      innerThickness: 2,
      outerColorId: 'outer',
      colors,
    });

    const dividers = walls.filter((w) => !w.isOuter);
    // h1's endpoint toward v1 must land exactly on v1's centerline (x=40).
    const hSegments = dividers.filter((w) => w.a.y === w.b.y);
    const reachesV1 = hSegments.some((w) => Math.max(w.a.x, w.b.x) === 40 || Math.min(w.a.x, w.b.x) === 40);
    expect(reachesV1).toBe(true);
  });

  it('gives every wall a deterministic id, stable across repeated extract() calls', () => {
    // extract() reruns on every project mutation (via a Pinia getter);
    // anything holding a wall id across renders -- selection state, an open
    // edit dialog -- must not go stale just because something unrelated
    // changed and triggered a recompute.
    const colors = makeColors();
    const line: GridLine = { id: 'v1', axis: 'x', positionMm: 40, colorId: 'divider', segmentOverrides: [] };
    const input = {
      grid: { lines: [line] },
      innerRect: { x: 0, y: 0, width: 100, height: 50 },
      outerThickness: 4,
      innerThickness: 2,
      outerColorId: 'outer',
      colors,
    };
    const first = extract(input)
      .map((w) => w.id)
      .sort();
    const second = extract(input)
      .map((w) => w.id)
      .sort();
    expect(second).toEqual(first);
    // The 4 outer walls specifically must be identifiable by side, not by
    // an opaque generated id, since they never correspond to a grid line.
    expect(first).toEqual(expect.arrayContaining(['outer-west', 'outer-east', 'outer-north', 'outer-south']));
  });
});
