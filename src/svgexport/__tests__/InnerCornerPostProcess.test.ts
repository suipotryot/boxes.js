import { describe, expect, it } from 'vitest';

import { applyInnerCornerStyle } from '../InnerCornerPostProcess';

const lShape = [
  { x: 0, y: 0 },
  { x: 20, y: 0 },
  { x: 20, y: 10 },
  { x: 10, y: 10 }, // the single concave (reflex) vertex
  { x: 10, y: 20 },
  { x: 0, y: 20 },
];

describe("applyInnerCornerStyle: 'corner'", () => {
  it('is a no-op', () => {
    expect(applyInnerCornerStyle(lShape, 'corner', 1)).toEqual(lShape);
  });
});

describe("applyInnerCornerStyle: 'backarc'", () => {
  it('leaves convex corners untouched', () => {
    const result = applyInnerCornerStyle(lShape, 'backarc', 1);
    expect(result).toContainEqual({ x: 0, y: 0 });
    expect(result).toContainEqual({ x: 20, y: 0 });
    expect(result).toContainEqual({ x: 20, y: 10 });
  });

  it('replaces the concave corner with a burn-radius arc tangent to both adjacent edges', () => {
    const result = applyInnerCornerStyle(lShape, 'backarc', 1);
    // The arc's first point is 1mm back from (10,10) along the incoming
    // edge (i.e. at (11,10)); its last point is 1mm along the outgoing
    // edge (at (10,11)) -- both tangent points computed by hand.
    const arcStart = result.find((p) => Math.abs(p.x - 11) < 1e-6 && Math.abs(p.y - 10) < 1e-6);
    const arcEnd = result.find((p) => Math.abs(p.x - 10) < 1e-6 && Math.abs(p.y - 11) < 1e-6);
    expect(arcStart).toBeDefined();
    expect(arcEnd).toBeDefined();

    // Every arc point stays at distance `burn` from the arc's center
    // (11,11) -- the corner pushed into the notch by burn on both axes.
    const center = { x: 11, y: 11 };
    const arcPoints = result.filter((p) => p.x >= 9.99 && p.x <= 11.01 && p.y >= 9.99 && p.y <= 11.01);
    expect(arcPoints.length).toBeGreaterThanOrEqual(2);
    for (const p of arcPoints) {
      expect(Math.hypot(p.x - center.x, p.y - center.y)).toBeCloseTo(1, 6);
    }
  });

  it('produces more points than the input when a concave corner is present', () => {
    const result = applyInnerCornerStyle(lShape, 'backarc', 1);
    expect(result.length).toBeGreaterThan(lShape.length);
  });

  it('is a no-op on a fully convex polygon (no concave corners to arc)', () => {
    const square = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    expect(applyInnerCornerStyle(square, 'backarc', 1)).toEqual(square);
  });
});

describe("applyInnerCornerStyle: 'loop'", () => {
  it('produces more points than the input when a concave corner is present', () => {
    const result = applyInnerCornerStyle(lShape, 'loop', 1);
    expect(result.length).toBeGreaterThan(lShape.length);
  });

  it('is a no-op on a fully convex polygon', () => {
    const square = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    expect(applyInnerCornerStyle(square, 'loop', 1)).toEqual(square);
  });

  it('overshoots past the corner into the notch, further than the plain corner point', () => {
    const result = applyInnerCornerStyle(lShape, 'loop', 1);
    const corner = { x: 10, y: 10 };
    const maxOvershoot = Math.max(...result.map((p) => Math.hypot(p.x - corner.x, p.y - corner.y)));
    expect(maxOvershoot).toBeGreaterThan(1); // further than a plain burn-radius arc point
  });
});
