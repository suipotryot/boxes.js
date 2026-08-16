import type { InnerCornerStyle } from '@/domain/models/Project';
import type { Point } from '@/domain/models/types';
import { EPSILON, crossZ, normalize, outwardNormal, simplifyPolygon, subtract } from '@/domain/services/GeometryUtils';

const ARC_SEGMENTS = 6;

/**
 * Post-processes an already burn-corrected outline at its concave (reflex)
 * corners, where a laser's round beam can't cut a perfectly sharp inside
 * corner:
 * - 'corner': no-op, the model is already sharp vertices.
 * - 'backarc': replaces the corner with a burn-radius arc tangent to both
 *   adjacent edges, rounding the inside corner instead of leaving it sharp.
 * - 'loop': a small relief that overshoots past the corner into the notch
 *   on both edges, fully clearing the kerf at the inside corner.
 */
export function applyInnerCornerStyle(points: Point[], style: InnerCornerStyle, burnMm: number): Point[] {
  if (style === 'corner' || burnMm <= 0) {
    return points;
  }
  const simplified = simplifyPolygon(points);
  const n = simplified.length;
  const result: Point[] = [];

  for (let i = 0; i < n; i++) {
    const prev = simplified[(i - 1 + n) % n]!;
    const p = simplified[i]!;
    const next = simplified[(i + 1) % n]!;
    const dIn = normalize(subtract(p, prev));
    const dOut = normalize(subtract(next, p));
    const isConcave = crossZ(dIn, dOut) < -EPSILON;

    if (!isConcave) {
      result.push(p);
      continue;
    }
    result.push(...(style === 'backarc' ? backArcPoints(p, dIn, dOut, burnMm) : loopPoints(p, dIn, dOut, burnMm)));
  }

  return result;
}

function backArcPoints(p: Point, dIn: Point, dOut: Point, burn: number): Point[] {
  const nIn = outwardNormal(dIn);
  const nOut = outwardNormal(dOut);
  const center = { x: p.x + burn * (nIn.x + nOut.x), y: p.y + burn * (nIn.y + nOut.y) };
  const tangentIn = { x: p.x - dIn.x * burn, y: p.y - dIn.y * burn };
  const tangentOut = { x: p.x + dOut.x * burn, y: p.y + dOut.y * burn };

  const startAngle = Math.atan2(tangentIn.y - center.y, tangentIn.x - center.x);
  const endAngle = Math.atan2(tangentOut.y - center.y, tangentOut.x - center.x);
  const delta = normalizeAngleDelta(endAngle - startAngle);

  const points: Point[] = [];
  for (let i = 0; i <= ARC_SEGMENTS; i++) {
    const angle = startAngle + (delta * i) / ARC_SEGMENTS;
    points.push({ x: center.x + Math.cos(angle) * burn, y: center.y + Math.sin(angle) * burn });
  }
  return points;
}

function normalizeAngleDelta(delta: number): number {
  let d = delta;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

/** A simplified dogbone-style relief: tangent points on each edge, with a
 * single overshoot point beyond the corner (into the notch) between them. */
function loopPoints(p: Point, dIn: Point, dOut: Point, burn: number): Point[] {
  const nIn = outwardNormal(dIn);
  const nOut = outwardNormal(dOut);
  const bisector = normalize({ x: nIn.x + nOut.x, y: nIn.y + nOut.y });
  const tangentIn = { x: p.x - dIn.x * burn, y: p.y - dIn.y * burn };
  const tangentOut = { x: p.x + dOut.x * burn, y: p.y + dOut.y * burn };
  const overshoot = { x: p.x + bisector.x * burn * 1.5, y: p.y + bisector.y * burn * 1.5 };
  return [tangentIn, overshoot, tangentOut];
}
