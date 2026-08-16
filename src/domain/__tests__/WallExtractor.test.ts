import { describe, expect, it } from 'vitest';

import { ColorHeightRegistry } from '../models/ColorHeightRegistry';
import type { ZoneLeaf, ZoneSplit } from '../models/Zone';
import { extract } from '../services/WallExtractor';

const leaf = (id: string): ZoneLeaf => ({ kind: 'leaf', id });

function makeColors(): ColorHeightRegistry {
  return new ColorHeightRegistry([
    { id: 'outer', color: '#888888', heightMm: 60 },
    { id: 'divider', color: '#ff0000', heightMm: 40 },
  ]);
}

describe('WallExtractor.extract', () => {
  it('produces the 4 outer walls (centerline convention) and no dividers for an empty box', () => {
    const colors = makeColors();
    const walls = extract({
      zoneTree: leaf('only'),
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

  it('adds one centered divider wall for a single x-axis split', () => {
    const colors = makeColors();
    const root: ZoneSplit = {
      kind: 'split',
      id: 'split1',
      axis: 'x',
      firstSize: 40,
      dividerColorId: 'divider',
      notches: [],
      first: leaf('left'),
      second: leaf('right'),
    };
    const walls = extract({
      zoneTree: root,
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
    // Gap is [40, 42] in x (firstSize=40, thickness=2) -> centerline at x=41.
    expect(divider!.a.x).toBeCloseTo(41);
    expect(divider!.b.x).toBeCloseTo(41);
    expect([divider!.a.y, divider!.b.y].sort((a, b) => a - b)).toEqual([0, 50]);
  });

  it('adds one centered divider wall for a single y-axis split', () => {
    const colors = makeColors();
    const root: ZoneSplit = {
      kind: 'split',
      id: 'split1',
      axis: 'y',
      firstSize: 20,
      dividerColorId: 'divider',
      notches: [],
      first: leaf('top'),
      second: leaf('bottom'),
    };
    const walls = extract({
      zoneTree: root,
      innerRect: { x: 0, y: 0, width: 60, height: 80 },
      outerThickness: 4,
      innerThickness: 4,
      outerColorId: 'outer',
      colors,
    });

    const divider = walls.find((w) => !w.isOuter)!;
    // Gap is [20, 24] in y -> centerline at y=22.
    expect(divider.a.y).toBeCloseTo(22);
    expect(divider.b.y).toBeCloseTo(22);
    expect([divider.a.x, divider.b.x].sort((a, b) => a - b)).toEqual([0, 60]);
  });

  it('produces one divider wall per split in a nested tree', () => {
    const colors = makeColors();
    const root: ZoneSplit = {
      kind: 'split',
      id: 'root',
      axis: 'x',
      firstSize: 40,
      dividerColorId: 'divider',
      notches: [],
      first: {
        kind: 'split',
        id: 'left-split',
        axis: 'y',
        firstSize: 30,
        dividerColorId: 'divider',
        notches: [],
        first: leaf('top-left'),
        second: leaf('bottom-left'),
      },
      second: leaf('right'),
    };
    const walls = extract({
      zoneTree: root,
      innerRect: { x: 0, y: 0, width: 100, height: 100 },
      outerThickness: 2,
      innerThickness: 2,
      outerColorId: 'outer',
      colors,
    });

    expect(walls.filter((w) => !w.isOuter)).toHaveLength(2);
  });
});
