import { describe, expect, it } from 'vitest';

import { approxEqual, pointKey, pointsEqual } from '../services/GeometryUtils';

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

describe('pointKey', () => {
  it('produces identical keys for float-dust-apart coordinates', () => {
    expect(pointKey({ x: 10.00000001, y: 20 })).toBe(pointKey({ x: 10, y: 20 }));
  });

  it('produces different keys for genuinely different points', () => {
    expect(pointKey({ x: 10, y: 20 })).not.toBe(pointKey({ x: 10, y: 21 }));
  });
});
