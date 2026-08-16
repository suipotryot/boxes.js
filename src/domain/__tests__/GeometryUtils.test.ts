import { describe, expect, it } from 'vitest';

import { approxEqual, pointsEqual } from '../services/GeometryUtils';

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
