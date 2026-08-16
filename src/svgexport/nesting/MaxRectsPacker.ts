import type { Panel } from '@/domain/models/Panel';
import type { Point, Rect } from '@/domain/models/types';
import type { PlacedPanel, PlacedRect } from './types';

/**
 * MaxRects bin packer (Jylänki, "A Thousand Ways to Pack the Bin"),
 * Best Short Side Fit heuristic, implemented from the algorithm's public
 * description rather than a port of any specific reference implementation.
 * Maintains the set of maximal free rectangles in the bin; each insertion
 * picks the free rectangle that leaves the smallest leftover on its
 * shorter side, then splits every free rectangle overlapping the newly
 * placed piece and prunes any free rectangle now fully contained in
 * another (both standard MaxRects bookkeeping, needed to keep the free
 * list from growing unboundedly and to avoid ever offering a
 * partially-occupied "free" rectangle for a later placement).
 */
export class MaxRectsBin {
  private freeRects: Rect[];
  readonly usedRects: PlacedRect[] = [];

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.freeRects = [{ x: 0, y: 0, width, height }];
  }

  insert(w: number, h: number, allowRotation: boolean): PlacedRect | null {
    const placement = this.findBestPosition(w, h, allowRotation);
    if (!placement) {
      return null;
    }
    this.placeRect(placement);
    this.usedRects.push(placement);
    return placement;
  }

  private findBestPosition(w: number, h: number, allowRotation: boolean): PlacedRect | null {
    let best: PlacedRect | null = null;
    let bestShortSideFit = Infinity;
    let bestLongSideFit = Infinity;

    const consider = (free: Rect, placedW: number, placedH: number, rotated: boolean): void => {
      if (free.width < placedW || free.height < placedH) {
        return;
      }
      const leftoverH = free.width - placedW;
      const leftoverV = free.height - placedH;
      const shortSide = Math.min(leftoverH, leftoverV);
      const longSide = Math.max(leftoverH, leftoverV);
      if (shortSide < bestShortSideFit || (shortSide === bestShortSideFit && longSide < bestLongSideFit)) {
        best = { x: free.x, y: free.y, width: placedW, height: placedH, rotated };
        bestShortSideFit = shortSide;
        bestLongSideFit = longSide;
      }
    };

    for (const free of this.freeRects) {
      consider(free, w, h, false);
      if (allowRotation) {
        consider(free, h, w, true);
      }
    }
    return best;
  }

  private placeRect(placed: Rect): void {
    const survivors: Rect[] = [];
    for (const free of this.freeRects) {
      splitFreeRect(free, placed, survivors);
    }
    this.freeRects = pruneContained(survivors);
  }
}

/** If `used` overlaps `free`, pushes the leftover pieces of `free` (up to
 * 4: left/right/top/bottom slivers) into `out` instead of `free` itself.
 * If there's no overlap, `free` is pushed through unchanged. */
function splitFreeRect(free: Rect, used: Rect, out: Rect[]): void {
  const overlaps = used.x < free.x + free.width && used.x + used.width > free.x && used.y < free.y + free.height && used.y + used.height > free.y;
  if (!overlaps) {
    out.push(free);
    return;
  }
  if (used.x > free.x) {
    out.push({ x: free.x, y: free.y, width: used.x - free.x, height: free.height });
  }
  if (used.x + used.width < free.x + free.width) {
    out.push({ x: used.x + used.width, y: free.y, width: free.x + free.width - (used.x + used.width), height: free.height });
  }
  if (used.y > free.y) {
    out.push({ x: free.x, y: free.y, width: free.width, height: used.y - free.y });
  }
  if (used.y + used.height < free.y + free.height) {
    out.push({ x: free.x, y: used.y + used.height, width: free.width, height: free.y + free.height - (used.y + used.height) });
  }
}

function pruneContained(rects: Rect[]): Rect[] {
  return rects.filter((a, i) => !rects.some((b, j) => i !== j && isContained(a, b)));
}

function isContained(a: Rect, b: Rect): boolean {
  return a.x >= b.x && a.y >= b.y && a.x + a.width <= b.x + b.width && a.y + a.height <= b.y + b.height;
}

/**
 * Packs one thickness group across as many bed-sized pages as needed.
 * Panels are inserted largest bounding-box area first (a standard
 * bin-packing heuristic: placing big pieces while the most free space is
 * still available tends to leave a friendlier residual shape for the
 * smaller pieces that follow). `spacing` is reserved as extra width/height
 * on each piece before insertion, so neighboring pieces end up at least
 * `spacing` apart -- simpler than padding every piece on all 4 sides,
 * which would double the gap at some boundaries for no benefit.
 *
 * Nesting uses each panel's *raw* (pre-burn-correction) outline bounding
 * box; burn is applied later per-page in SvgPathBuilder. Since burn is
 * always tiny relative to spacing in practice, this is deliberately not
 * accounted for here rather than threading burnMm through the packer too.
 */
export function packThicknessGroup(panels: Panel[], bedW: number, bedH: number, spacing: number, allowRotation: boolean): PlacedPanel[][] {
  const sorted = [...panels].sort((a, b) => bboxArea(b) - bboxArea(a));
  const bins: MaxRectsBin[] = [];
  const pages: PlacedPanel[][] = [];

  for (const panel of sorted) {
    const box = boundingBox(panel.outline);
    const w = box.width + spacing;
    const h = box.height + spacing;

    let placed: PlacedRect | null = null;
    let pageIndex = -1;
    for (let i = 0; i < bins.length; i++) {
      placed = bins[i]!.insert(w, h, allowRotation);
      if (placed) {
        pageIndex = i;
        break;
      }
    }
    if (!placed) {
      const bin = new MaxRectsBin(bedW, bedH);
      placed = bin.insert(w, h, allowRotation);
      if (!placed) {
        throw new Error(`Panel ${panel.id} (${box.width}x${box.height}mm) does not fit on a ${bedW}x${bedH}mm bed, even alone.`);
      }
      bins.push(bin);
      pages.push([]);
      pageIndex = pages.length - 1;
    }
    pages[pageIndex]!.push({ panel, x: placed.x, y: placed.y, rotated: placed.rotated });
  }

  return pages;
}

function boundingBox(points: Point[]): Rect {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return { x: minX, y: minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY };
}

function bboxArea(panel: Panel): number {
  const box = boundingBox(panel.outline);
  return box.width * box.height;
}
