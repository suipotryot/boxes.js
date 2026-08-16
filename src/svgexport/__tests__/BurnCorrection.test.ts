import { describe, expect, it } from 'vitest';

import { correctPathForBurn } from '../BurnCorrection';

describe('correctPathForBurn', () => {
  it('pushes every corner of a CCW outer square outward by burn on both adjacent edges', () => {
    const square = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    const result = correctPathForBurn(square, 1, false);
    // Each corner shifts diagonally by (±1, ±1) away from the square's center.
    expect(result).toEqual([
      { x: -1, y: -1 },
      { x: 11, y: -1 },
      { x: 11, y: 11 },
      { x: -1, y: 11 },
    ]);
  });

  it('does nothing when burn is 0', () => {
    const square = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    expect(correctPathForBurn(square, 0, false)).toEqual(square);
  });

  it('shrinks a hole (rectangle) inward by burn on every edge -- opposite sense of an outer contour', () => {
    const hole = [
      { x: 2, y: 2 },
      { x: 8, y: 2 },
      { x: 8, y: 8 },
      { x: 2, y: 8 },
    ];
    const result = correctPathForBurn(hole, 1, true);
    expect(result).toEqual([
      { x: 3, y: 3 },
      { x: 7, y: 3 },
      { x: 7, y: 7 },
      { x: 3, y: 7 },
    ]);
  });

  it('pulls a concave (L-shape) corner further into the notch, enlarging it', () => {
    // L-shape CCW: the reflex corner at (10,10) should move to (10+burn,10+burn).
    const lShape = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 10 },
      { x: 10, y: 10 },
      { x: 10, y: 20 },
      { x: 0, y: 20 },
    ];
    const result = correctPathForBurn(lShape, 1, false);
    expect(result[3]).toEqual({ x: 11, y: 11 });
  });

  it('simplifies collinear redundant points first, so they are not double-offset', () => {
    // (5,0) is a redundant point on the bottom edge of an otherwise plain
    // square -- without simplification this vertex would incorrectly get
    // offset by 2x burn (summing two near-identical outward normals).
    const squareWithRedundantPoint = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    const result = correctPathForBurn(squareWithRedundantPoint, 1, false);
    expect(result).toEqual([
      { x: -1, y: -1 },
      { x: 11, y: -1 },
      { x: 11, y: 11 },
      { x: -1, y: 11 },
    ]);
  });
});
