// A user-placed "trou" (hole): a rectangle, optionally corner-rounded,
// fully enclosed inside a piece's own local (x,y) space — never anchored
// to an edge (unlike Notch, which is always cut into an Edge's own free
// edge). Both x and y are entirely free, so this applies uniformly to ANY
// flat piece (wall, base plate, lid, and their drawer equivalents).
import { Cutout, arcPoints } from './Cutout.js';

export const DEFAULT_HOLE = { xMm: 20, yMm: 10, widthMm: 20, heightMm: 15, radiusMm: 0 };

export class Hole extends Cutout {
  constructor({ xMm, yMm, widthMm, heightMm, radiusMm }) {
    super(radiusMm);
    this.xMm = xMm;
    this.yMm = yMm;
    this.widthMm = widthMm;
    this.heightMm = heightMm;
  }

  /** Both of a hole's dimensions are free (neither is pinned to an edge
   *  the way a Notch's depth is), so its corner radius caps at half the
   *  SMALLER of the two — beyond that the two arcs on the short axis
   *  would have to overlap. */
  maxRadiusMm() {
    return Math.max(0, Math.min(this.widthMm, this.heightMm) / 2);
  }

  toTextLine() {
    return [this.xMm, this.yMm, this.widthMm, this.heightMm, this.radiusMm].join(', ');
  }

  static fromTextLine(text) {
    const nums = Cutout.parseNumbers(text, 5);
    if (!nums) return null;
    const [xMm, yMm, widthMm, heightMm, radiusMm] = nums;
    return new Hole({ xMm, yMm, widthMm, heightMm, radiusMm });
  }

  static listFor(pieceHoles, pieceId) {
    return ((pieceHoles && pieceHoles[pieceId]) || []).map((h) => new Hole(h));
  }

  /** A moved copy, offset by (dxMm,dyMm) — call from the ORIGINAL hole
   *  (the one at drag-start), not an already-moved one, so a caller
   *  recomputing the delta from the drag's start on every pointermove
   *  never accumulates rounding drift. */
  movedBy(dxMm, dyMm) {
    return this.withChanges({ xMm: this.xMm + dxMm, yMm: this.yMm + dyMm });
  }

  /** A resized copy whose xMm/yMm corner stays fixed while the opposite
   *  corner is dragged toward `targetPoint` ({x,y}, in the hole's own
   *  local mm space) — each axis floors independently at `minSizeMm` so
   *  dragging past the anchor corner can't invert or zero out the hole. */
  resizedToward(targetPoint, minSizeMm) {
    return this.withChanges({
      widthMm: Math.max(minSizeMm, targetPoint.x - this.xMm),
      heightMm: Math.max(minSizeMm, targetPoint.y - this.yMm),
    });
  }

  /** This hole's own closed polygon in the piece's local (x,y) space.
   *  radius<=0: the plain 4 rectangle corners, wound bottom-left ->
   *  bottom-right -> top-right -> top-left — the same order every other
   *  rectangular hole in this codebase uses, so BurnCorrection's shared
   *  outward-normal formula shrinks it inward, not outward.
   *  radius>0: each corner becomes its own quarter-circle fillet in that
   *  same rotational order, clamped defensively to maxRadiusMm so an
   *  over-large radius degenerates into a stadium/circle shape instead of
   *  self-intersecting. */
  polygon() {
    const x0 = this.xMm, y0 = this.yMm, x1 = this.xMm + this.widthMm, y1 = this.yMm + this.heightMm;
    const r = this.clampedRadiusMm();

    if (r <= 1e-9) {
      return [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
    }

    const corners = [
      { cx: x0 + r, cy: y0 + r, start: 180 }, // bottom-left
      { cx: x1 - r, cy: y0 + r, start: 270 }, // bottom-right
      { cx: x1 - r, cy: y1 - r, start: 0 },   // top-right
      { cx: x0 + r, cy: y1 - r, start: 90 },  // top-left
    ];
    return corners.flatMap(({ cx, cy, start }) => arcPoints(cx, cy, r, start));
  }
}
