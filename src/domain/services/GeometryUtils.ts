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
 * neighbors (same incoming/outgoing direction, not a reversal), and exact
 * (zero-length-edge) duplicates of their predecessor -- these carry no real
 * geometry but would otherwise double-count in per-vertex offset math like
 * burn correction, which assumes every point is a genuine corner. Exact
 * duplicates need their own check: when `p` and `prev` coincide, `dIn` is
 * the zero vector, so `dot = 0` fails the `dot > 0` colinearity test below
 * even though the point is exactly as redundant as a colinear one -- this
 * showed up in practice wherever two consecutive edge segments both sit on
 * the same baseline (e.g. a 'space' segment immediately followed by a
 * 'flush' margin in a finger comb, both offset 0), leaving a same-position
 * point that burn correction would then offset *twice*, slightly
 * differently each time (its two neighbors differ even though its own
 * position doesn't) -- visible in SVG export as a short doubled line. */
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

      if (pointsEqual(p, prev, epsilon)) {
        changed = true;
        continue;
      }

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
