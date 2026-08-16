import { describe, expect, it } from 'vitest';

import type { ZoneLeaf, ZoneSplit } from '../models/Zone';
import { computeBoundarySides, computeZoneRects } from '../services/ZoneTree';

const leaf = (id: string): ZoneLeaf => ({ kind: 'leaf', id });

describe('computeZoneRects', () => {
  it('returns the root rect unchanged for a single leaf', () => {
    const root = leaf('a');
    const rects = computeZoneRects(root, { x: 0, y: 0, width: 100, height: 50 }, 3);
    expect(rects.get('a')).toEqual({ x: 0, y: 0, width: 100, height: 50 });
  });

  it('splits a single vertical (x-axis) division, offsetting the second child by firstSize + thickness', () => {
    const root: ZoneSplit = {
      kind: 'split',
      id: 's1',
      axis: 'x',
      firstSize: 40,
      dividerColorId: 'c1',
      notches: [],
      first: leaf('left'),
      second: leaf('right'),
    };
    const rects = computeZoneRects(root, { x: 0, y: 0, width: 100, height: 50 }, 3);
    expect(rects.get('left')).toEqual({ x: 0, y: 0, width: 40, height: 50 });
    // second child starts at 40 + 3 = 43, remaining width = 100 - 40 - 3 = 57
    expect(rects.get('right')).toEqual({ x: 43, y: 0, width: 57, height: 50 });
  });

  it('splits a single horizontal (y-axis) division, offsetting the second child by firstSize + thickness', () => {
    const root: ZoneSplit = {
      kind: 'split',
      id: 's1',
      axis: 'y',
      firstSize: 20,
      dividerColorId: 'c1',
      notches: [],
      first: leaf('top'),
      second: leaf('bottom'),
    };
    const rects = computeZoneRects(root, { x: 0, y: 0, width: 60, height: 80 }, 4);
    expect(rects.get('top')).toEqual({ x: 0, y: 0, width: 60, height: 20 });
    // second child starts at 20 + 4 = 24, remaining height = 80 - 20 - 4 = 56
    expect(rects.get('bottom')).toEqual({ x: 0, y: 24, width: 60, height: 56 });
  });

  it('respects a non-zero root origin', () => {
    const root: ZoneSplit = {
      kind: 'split',
      id: 's1',
      axis: 'x',
      firstSize: 10,
      dividerColorId: 'c1',
      notches: [],
      first: leaf('left'),
      second: leaf('right'),
    };
    const rects = computeZoneRects(root, { x: 5, y: 5, width: 30, height: 10 }, 2);
    expect(rects.get('left')).toEqual({ x: 5, y: 5, width: 10, height: 10 });
    expect(rects.get('right')).toEqual({ x: 17, y: 5, width: 18, height: 10 });
  });

  it('folds a nested 2x2 tree (x-split at root, y-split in each half) -- computed by hand', () => {
    // Root: 100x100, thickness 2. First x-split at 40 -> left [0,40), right [42,100).
    // Each half is then y-split at 30 -> top [0,30), bottom [32, half-height).
    const root: ZoneSplit = {
      kind: 'split',
      id: 'root',
      axis: 'x',
      firstSize: 40,
      dividerColorId: 'c1',
      notches: [],
      first: {
        kind: 'split',
        id: 'left-split',
        axis: 'y',
        firstSize: 30,
        dividerColorId: 'c2',
        notches: [],
        first: leaf('top-left'),
        second: leaf('bottom-left'),
      },
      second: {
        kind: 'split',
        id: 'right-split',
        axis: 'y',
        firstSize: 30,
        dividerColorId: 'c2',
        notches: [],
        first: leaf('top-right'),
        second: leaf('bottom-right'),
      },
    };

    const rects = computeZoneRects(root, { x: 0, y: 0, width: 100, height: 100 }, 2);

    // Left column: x in [0, 40), Right column: x starts at 40 + 2 = 42, width = 58.
    expect(rects.get('top-left')).toEqual({ x: 0, y: 0, width: 40, height: 30 });
    expect(rects.get('bottom-left')).toEqual({ x: 0, y: 32, width: 40, height: 68 });
    expect(rects.get('top-right')).toEqual({ x: 42, y: 0, width: 58, height: 30 });
    expect(rects.get('bottom-right')).toEqual({ x: 42, y: 32, width: 58, height: 68 });
  });

  it('also records the combined rect for split nodes themselves, not just leaves', () => {
    const root: ZoneSplit = {
      kind: 'split',
      id: 'root',
      axis: 'x',
      firstSize: 40,
      dividerColorId: 'c1',
      notches: [],
      first: leaf('left'),
      second: leaf('right'),
    };
    const rects = computeZoneRects(root, { x: 0, y: 0, width: 100, height: 50 }, 3);
    // The split node's own rect is the full span it received -- useful downstream
    // to position the divider wall it creates.
    expect(rects.get('root')).toEqual({ x: 0, y: 0, width: 100, height: 50 });
  });
});

describe('computeBoundarySides', () => {
  it('marks all 4 sides of the root as outer', () => {
    const sides = computeBoundarySides(leaf('only'));
    expect(sides.get('only')).toEqual({ north: 'outer', south: 'outer', east: 'outer', west: 'outer' });
  });

  it('marks the new facing side of each child as inner for an x-axis split, others inherited', () => {
    const root: ZoneSplit = {
      kind: 'split',
      id: 'root',
      axis: 'x',
      firstSize: 40,
      dividerColorId: 'c1',
      notches: [],
      first: leaf('left'),
      second: leaf('right'),
    };
    const sides = computeBoundarySides(root);
    expect(sides.get('left')).toEqual({ north: 'outer', south: 'outer', east: 'inner', west: 'outer' });
    expect(sides.get('right')).toEqual({ north: 'outer', south: 'outer', east: 'outer', west: 'inner' });
  });

  it('marks the new facing side of each child as inner for a y-axis split, others inherited', () => {
    const root: ZoneSplit = {
      kind: 'split',
      id: 'root',
      axis: 'y',
      firstSize: 20,
      dividerColorId: 'c1',
      notches: [],
      first: leaf('top'),
      second: leaf('bottom'),
    };
    const sides = computeBoundarySides(root);
    expect(sides.get('top')).toEqual({ north: 'outer', south: 'inner', east: 'outer', west: 'outer' });
    expect(sides.get('bottom')).toEqual({ north: 'inner', south: 'outer', east: 'outer', west: 'outer' });
  });

  it('a grandchild split against the outer boundary on 3 sides and inner on the 4th propagates correctly', () => {
    // Root x-split: left becomes further y-split.
    const root: ZoneSplit = {
      kind: 'split',
      id: 'root',
      axis: 'x',
      firstSize: 40,
      dividerColorId: 'c1',
      notches: [],
      first: {
        kind: 'split',
        id: 'left-split',
        axis: 'y',
        firstSize: 20,
        dividerColorId: 'c2',
        notches: [],
        first: leaf('top-left'),
        second: leaf('bottom-left'),
      },
      second: leaf('right'),
    };
    const sides = computeBoundarySides(root);
    // left-split inherited west/north/south='outer' from root's left child, but east='inner'.
    expect(sides.get('left-split')).toEqual({ north: 'outer', south: 'outer', east: 'inner', west: 'outer' });
    // top-left further narrows south to 'inner' (its own new divider), keeps the rest.
    expect(sides.get('top-left')).toEqual({ north: 'outer', south: 'inner', east: 'inner', west: 'outer' });
  });
});
