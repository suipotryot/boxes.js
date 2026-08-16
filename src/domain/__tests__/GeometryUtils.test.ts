import { describe, expect, it } from 'vitest';

import {
  approxEqual,
  crossZ,
  normalize,
  outwardNormal,
  pointKey,
  pointsEqual,
  simplifyPolygon,
  subtract,
} from '../services/GeometryUtils';

describe('approxEqual', () => {
  it('treats values within epsilon as equal', () => {
    expect(approxEqual(1, 1.0000001)).toBe(true);
  });

  it('treats values beyond epsilon as different', () => {
    expect(approxEqual(1, 1.1)).toBe(false);
  });

  it('accepts a custom epsilon', () => {
    expect(approxEqual(1, 1.05, 0.1)).toBe(true);
    expect(approxEqual(1, 1.2, 0.1)).toBe(false);
  });
});

describe('pointsEqual', () => {
  it('is true when both coordinates match within epsilon', () => {
    expect(pointsEqual({ x: 10, y: 20 }, { x: 10.0000001, y: 20 })).toBe(true);
  });

  it('is false when only one coordinate matches', () => {
    expect(pointsEqual({ x: 10, y: 20 }, { x: 10, y: 21 })).toBe(false);
  });
});

describe('subtract / normalize / crossZ', () => {
  it('subtract gives the vector from a to b', () => {
    expect(subtract({ x: 5, y: 5 }, { x: 2, y: 1 })).toEqual({ x: 3, y: 4 });
  });

  it('normalize produces a unit vector in the same direction', () => {
    const n = normalize({ x: 3, y: 4 });
    expect(n.x).toBeCloseTo(0.6, 6);
    expect(n.y).toBeCloseTo(0.8, 6);
  });

  it('crossZ is positive for a left turn (CCW), negative for a right turn (CW)', () => {
    expect(crossZ({ x: 1, y: 0 }, { x: 0, y: 1 })).toBeGreaterThan(0);
    expect(crossZ({ x: 1, y: 0 }, { x: 0, y: -1 })).toBeLessThan(0);
  });
});

describe('outwardNormal', () => {
  it('rotates a direction vector -90 degrees (clockwise)', () => {
    const a = outwardNormal({ x: 1, y: 0 });
    expect(a.x).toBeCloseTo(0, 6);
    expect(a.y).toBeCloseTo(-1, 6);
    const b = outwardNormal({ x: 0, y: 1 });
    expect(b.x).toBeCloseTo(1, 6);
    expect(b.y).toBeCloseTo(0, 6);
  });
});

describe('simplifyPolygon', () => {
  it('removes a redundant point sitting exactly on a straight edge', () => {
    // (0,0) -> (5,0) -> (10,0) -> (10,10) -> (0,10): the point at (5,0) adds
    // nothing, it's collinear with its neighbors on the bottom edge.
    const points = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    const result = simplifyPolygon(points);
    expect(result).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ]);
  });

  it('keeps every vertex of a polygon with no redundant points', () => {
    const square = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    expect(simplifyPolygon(square)).toEqual(square);
  });

  it('handles redundancy that wraps around the closing edge (first/last point)', () => {
    // Redundant point at (10,0) is collinear across the wrap from the last
    // point (10,-5) back to the first (10,10) -- wait, use a clean wrap case:
    // (0,0) -> (10,0) -> (10,10) -> (5,10) -> (0,10), where (5,10) is
    // redundant between (10,10) and (0,10).
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 5, y: 10 },
      { x: 0, y: 10 },
    ];
    const result = simplifyPolygon(points);
    expect(result).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ]);
  });

  it('removes an exact (zero-length-edge) duplicate of the previous point, keeping the genuine corner it sits at', () => {
    // This is what two consecutive edge segments both sitting on the same
    // baseline produce (e.g. a finger-comb 'space' segment immediately
    // followed by a 'flush' margin, both offset 0) -- a genuinely
    // colinearity-based check misses this, since the incoming vector is
    // the zero vector and its dot product with anything is 0, not > 0.
    // (10,0) itself is a real corner here (not colinear with its
    // neighbors), so only the duplicate should disappear, not the corner.
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 0 }, // exact duplicate of the point before it
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    const result = simplifyPolygon(points);
    expect(result).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ]);
  });

  it('removes a duplicate even when it sits exactly at the wrap-around (last point duplicating the first)', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 0, y: 0 }, // duplicate of the first point, at the end
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    const result = simplifyPolygon(points);
    expect(result).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ]);
  });
});

describe('pointKey', () => {
  it('produces identical keys for float-dust-apart coordinates', () => {
    expect(pointKey({ x: 10.00000001, y: 20 })).toBe(pointKey({ x: 10, y: 20 }));
  });

  it('produces different keys for genuinely different points', () => {
    expect(pointKey({ x: 10, y: 20 })).not.toBe(pointKey({ x: 10, y: 21 }));
  });
});
