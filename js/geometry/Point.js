// Minimal 2D point/vector helpers. Points are plain {x,y} objects (mm).

export function add(a, b) { return { x: a.x + b.x, y: a.y + b.y }; }
export function sub(a, b) { return { x: a.x - b.x, y: a.y - b.y }; }
export function scale(a, s) { return { x: a.x * s, y: a.y * s }; }
export function length(a) { return Math.hypot(a.x, a.y); }
export function normalize(a) {
  const l = length(a);
  return l < 1e-12 ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l };
}
export function dot(a, b) { return a.x * b.x + a.y * b.y; }
export function cross(a, b) { return a.x * b.y - a.y * b.x; }
export function pointsEqual(a, b, epsilon = 1e-6) {
  return Math.abs(a.x - b.x) < epsilon && Math.abs(a.y - b.y) < epsilon;
}

// Drops exact-duplicate consecutive points and collinear midpoints from a
// closed polygon. Exact duplicates matter as much as collinear points here:
// a repeated point gives a zero-length incoming edge, which independent
// per-vertex burn correction later would offset inconsistently and leave a
// stray doubled line in the SVG output.
export function simplifyPolygon(points, epsilon = 1e-6) {
  const n = points.length;
  if (n < 3) return points.slice();
  const out = [];
  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n];
    const cur = points[i];
    const next = points[(i + 1) % n];
    if (pointsEqual(cur, prev, epsilon)) continue;
    const d1 = normalize(sub(cur, prev));
    const d2 = normalize(sub(next, cur));
    const isCollinear = Math.abs(cross(d1, d2)) < epsilon && dot(d1, d2) > 0;
    if (isCollinear) continue;
    out.push(cur);
  }
  return out.length >= 3 ? out : points.slice();
}
