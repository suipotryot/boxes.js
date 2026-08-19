// Kerf (burn) compensation: offset every vertex by the sum of its two
// adjacent edges' outward normals, scaled by burnMm. Outlines grow (cut
// line moves outward so the part ends up full size after the laser removes
// burnMm of material); holes shrink (same formula, sign flipped since
// "outward" for a hole points into the material being removed).
// One uniform formula for convex and concave corners alike — no branch
// needed, since the outward-normal sum degrades gracefully at both.
import { simplifyPolygon, sub, add, scale, normalize } from './Point.js';

function outwardNormal(prev, cur, next) {
  const d1 = normalize(sub(cur, prev));
  const d2 = normalize(sub(next, cur));
  // Rotate each edge direction -90° (clockwise) to get its outward normal
  // for a polygon wound the way this codebase winds outlines (see
  // PanelBuilder/BasePlateBuilder edge order).
  const n1 = { x: d1.y, y: -d1.x };
  const n2 = { x: d2.y, y: -d2.x };
  return normalize(add(n1, n2));
}

function offsetPolygon(points, distance) {
  const n = points.length;
  return points.map((cur, i) => {
    const prev = points[(i - 1 + n) % n];
    const next = points[(i + 1) % n];
    const normal = outwardNormal(prev, cur, next);
    return add(cur, scale(normal, distance));
  });
}

export function burnCorrect(piece, burnMm) {
  if (!burnMm) return piece;
  const outline = simplifyPolygon(piece.outline);
  const holes = piece.holes.map((h) => simplifyPolygon(h));
  return {
    ...piece,
    outline: offsetPolygon(outline, burnMm),
    holes: holes.map((h) => offsetPolygon(h, -burnMm)),
  };
}
