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

export function subtract(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function normalize(v: Point): Point {
  const length = Math.hypot(v.x, v.y);
  return length < EPSILON ? { x: 0, y: 0 } : { x: v.x / length, y: v.y / length };
}

/** Z-component of the 2D cross product: positive for a left (CCW) turn from a to b. */
export function crossZ(a: Point, b: Point): number {
  return a.x * b.y - a.y * b.x;
}

/** Rotates a direction vector -90 degrees (clockwise) -- the outward normal
 * of an edge on a CCW-wound polygon. */
export function outwardNormal(direction: Point): Point {
  return { x: direction.y, y: -direction.x };
}

/** Drops vertices that sit exactly on a straight run between their
 * neighbors (same incoming/outgoing direction, not a reversal) -- these
 * carry no real geometry but would otherwise double-count in per-vertex
 * offset math like burn correction, which assumes every point is a genuine
 * corner. */
export function simplifyPolygon(points: Point[], epsilon: number = EPSILON): Point[] {
  if (points.length < 3) {
    return points;
  }
  let current = points;
  let changed = true;
  while (changed && current.length > 2) {
    changed = false;
    const next: Point[] = [];
    const n = current.length;
    for (let i = 0; i < n; i++) {
      const prev = current[(i - 1 + n) % n]!;
      const p = current[i]!;
      const nextP = current[(i + 1) % n]!;
      const dIn = subtract(p, prev);
      const dOut = subtract(nextP, p);
      const cross = crossZ(dIn, dOut);
      const dot = dIn.x * dOut.x + dIn.y * dOut.y;
      const isRedundant = Math.abs(cross) < epsilon && dot > 0;
      if (isRedundant) {
        changed = true;
        continue;
      }
      next.push(p);
    }
    current = next;
  }
  return current;
}
