import type { Point } from '@/domain/models/types';
import { normalize, outwardNormal, simplifyPolygon, subtract } from '@/domain/services/GeometryUtils';

/**
 * Compensates for laser kerf on an entirely rectilinear model: at each
 * vertex, both adjacent edges are shifted outward (away from the solid
 * material) by `burnMm`, so the vertex moves by the sum of both edges'
 * outward normals scaled by burn. This single formula handles convex and
 * concave corners uniformly -- no explicit branch needed, the normals'
 * signs already encode it (verified against boxes.py's plain-language
 * convex/concave description: a convex corner's normals reinforce, a
 * concave corner's cancel just enough to still push each adjacent edge
 * outward by exactly `burn`, which for a reflex corner in the outer
 * contour reads as "enlarge the notch").
 *
 * Holes are subtractive, so their kerf compensation is the opposite sense
 * of a solid boundary -- a hole must shrink, not grow, to end up at its
 * nominal size once the kerf is cut away -- hence `isHole` flips the sign.
 *
 * Requires a genuinely simplified polygon (no redundant collinear points)
 * to avoid double-offsetting a non-corner vertex, so this always
 * simplifies first regardless of what the caller passed in.
 */
export function correctPathForBurn(points: Point[], burnMm: number, isHole: boolean): Point[] {
  if (burnMm === 0) {
    return points;
  }
  const simplified = simplifyPolygon(points);
  const sign = isHole ? -1 : 1;
  const n = simplified.length;

  return simplified.map((p, i) => {
    const prev = simplified[(i - 1 + n) % n]!;
    const next = simplified[(i + 1) % n]!;
    const dIn = normalize(subtract(p, prev));
    const dOut = normalize(subtract(next, p));
    const nIn = outwardNormal(dIn);
    const nOut = outwardNormal(dOut);
    return {
      x: p.x + sign * burnMm * (nIn.x + nOut.x),
      y: p.y + sign * burnMm * (nIn.y + nOut.y),
    };
  });
}
