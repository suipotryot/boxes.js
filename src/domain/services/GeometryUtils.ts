import type { Point } from '../models/types';

export const EPSILON = 1e-6;

export function approxEqual(a: number, b: number, epsilon: number = EPSILON): boolean {
  return Math.abs(a - b) < epsilon;
}

export function pointsEqual(a: Point, b: Point, epsilon: number = EPSILON): boolean {
  return approxEqual(a.x, b.x, epsilon) && approxEqual(a.y, b.y, epsilon);
}

/** Canonical string key for a point, rounded to kill float dust -- usable in a Map/Set. */
export function pointKey(p: Point, precision: number = 4): string {
  return `${p.x.toFixed(precision)},${p.y.toFixed(precision)}`;
}

export function createId(prefix?: string): string {
  const uuid = crypto.randomUUID();
  return prefix ? `${prefix}-${uuid}` : uuid;
}
