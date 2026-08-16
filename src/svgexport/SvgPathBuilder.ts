import type { InnerCornerStyle } from '@/domain/models/Project';
import type { Panel } from '@/domain/models/Panel';
import type { Point } from '@/domain/models/types';
import { correctPathForBurn } from './BurnCorrection';
import { applyInnerCornerStyle } from './InnerCornerPostProcess';

/** Builds a single SVG `<path>` d-string for a panel: outline and holes as
 * subpaths, `fill-rule="evenodd"` (set by the caller) making the holes
 * subtract regardless of their winding direction. */
export function buildPanelPath(panel: Panel, burnMm: number, cornerStyle: InnerCornerStyle): string {
  const outline = processContour(panel.outline, burnMm, cornerStyle, false);
  const holes = panel.holes.map((hole) => processContour(hole, burnMm, cornerStyle, true));
  return [outline, ...holes].map(toSubpath).join(' ');
}

function processContour(points: Point[], burnMm: number, cornerStyle: InnerCornerStyle, isHole: boolean): Point[] {
  const corrected = correctPathForBurn(points, burnMm, isHole);
  return applyInnerCornerStyle(corrected, cornerStyle, burnMm);
}

function toSubpath(points: Point[]): string {
  if (points.length === 0) {
    return '';
  }
  const [first, ...rest] = points;
  const move = `M ${fmt(first!.x)} ${fmt(first!.y)}`;
  const lines = rest.map((p) => `L ${fmt(p.x)} ${fmt(p.y)}`).join(' ');
  return `${move} ${lines} Z`;
}

function fmt(n: number): string {
  return Number(n.toFixed(3)).toString();
}
