// A "grip notch" (encoche pour doigt): a user-placed cutout always anchored
// to an Edge's own free edge. Defined by width/depth/offset (from the
// edge's own u=0 end) plus a single corner-radius field: 0 gives a
// flat-bottomed rectangular notch, and radius === maxRadiusMm() gives the
// most rounded shape possible for that width/depth — a full semicircle
// specifically when depth also equals width/2. One continuous
// parameterization, not a shape toggle.
//
// A Panel can have several — always soldered directly into the outline
// (never a separate hole), because two independently burn-corrected
// sub-tracks can drift apart and leave an uncut sliver (see Hole.js's own
// header comment for the contrasting case).
import { Cutout, arcPoints } from './Cutout.js';

export const DEFAULT_NOTCH = { widthMm: 30, depthMm: 15, offsetMm: 10, radiusMm: 0 };

export class Notch extends Cutout {
  constructor({ widthMm, depthMm, offsetMm, radiusMm }) {
    super(radiusMm);
    this.widthMm = widthMm;
    this.depthMm = depthMm;
    this.offsetMm = offsetMm;
  }

  maxRadiusMm() {
    return Math.max(0, Math.min(this.widthMm / 2, this.depthMm));
  }

  toTextLine() {
    return [this.widthMm, this.depthMm, this.radiusMm, this.offsetMm].join(', ');
  }

  static fromTextLine(text) {
    const nums = Cutout.parseNumbers(text, 4);
    if (!nums) return null;
    const [widthMm, depthMm, radiusMm, offsetMm] = nums;
    return new Notch({ widthMm, depthMm, radiusMm, offsetMm });
  }

  /** The list of notches configured for one piece — normalizing away two
   *  other shapes a stored value can legitimately have: absent (no entry
   *  yet) and the OLD single-object-with-`enabled` shape this feature
   *  shipped with before multiple notches per piece existed (kept
   *  readable rather than silently discarded, since real projects were
   *  already saved under that shape). Always returns a real array. */
  static listFor(pieceNotches, pieceId) {
    const stored = pieceNotches && pieceNotches[pieceId];
    const items = Array.isArray(stored) ? stored : stored && stored.enabled ? [stored] : [];
    return items.map((n) => new Notch(n));
  }

  /** A moved copy, offset by dxMm along the edge only — unlike Hole.movedBy
   *  there is no dyMm: a notch's position perpendicular to its edge is
   *  never free (see class header), only its depth, which is a resize, not
   *  a move. Call from the ORIGINAL notch (the one at drag-start), not an
   *  already-moved one, so a caller recomputing the delta from the drag's
   *  start on every pointermove never accumulates rounding drift. */
  movedBy(dxMm) {
    return this.withChanges({ offsetMm: this.offsetMm + dxMm });
  }

  /** A resized copy whose anchor corner — offsetMm (left) and this notch's
   *  own edge line at `localHeightMm` (top) — stays fixed while the
   *  opposite corner is dragged toward `targetPoint` ({x,y}, in the
   *  piece's own local mm space): widthMm grows toward
   *  `targetPoint.x - offsetMm`, depthMm grows toward
   *  `localHeightMm - targetPoint.y`. Each axis floors independently at
   *  `minSizeMm` so dragging past the anchor can't invert or zero out the
   *  notch. `localHeightMm` is a parameter (unlike Hole.resizedToward)
   *  because a notch doesn't know the wall's local height at its own
   *  position — the caller passes the same value production already
   *  computes via heightAt(spans, ...) (see Assembly.js's own
   *  gripFragments). */
  resizedToward(targetPoint, minSizeMm, localHeightMm) {
    return this.withChanges({
      widthMm: Math.max(minSizeMm, targetPoint.x - this.offsetMm),
      depthMm: Math.max(minSizeMm, localHeightMm - targetPoint.y),
    });
  }

  /** {uStart, uEnd, points:[{u,y}...]} in the edge's own local space, for
   *  Edge.points() to splice into its outline.
   *  radius<=0: 2 points (a flat floor) — the notch's own 2 vertical walls
   *  appear implicitly from the "jump" against the un-notched point on
   *  either side, exactly like the crossing-notch mechanism.
   *  radius>0: a quarter-circle fillet at each bottom corner (center
   *  `radius` in from that corner), with a flat floor between them only
   *  when radius < width/2 — otherwise the two fillets meet at the exact
   *  center with no flat stretch left. Both caps maxed out at once
   *  (radius = width/2 = depth) is what makes this degenerate into a full
   *  semicircle — a limit of this one formula, not a separate branch. */
  toEdgeFragment(localHeight) {
    const uStart = this.offsetMm;
    const uEnd = this.offsetMm + this.widthMm;
    const floor = localHeight - this.depthMm;
    const radius = this.clampedRadiusMm();

    if (radius <= 1e-9) {
      return { uStart, uEnd, points: [{ u: uStart, y: floor }, { u: uEnd, y: floor }] };
    }

    const toUY = (pts) => pts.map((p) => ({ u: p.x, y: p.y }));
    const points = [
      ...toUY(arcPoints(uStart + radius, floor + radius, radius, 180)),
      ...(uEnd - radius > uStart + radius + 1e-9 ? [{ u: uEnd - radius, y: floor }] : []),
      ...toUY(arcPoints(uEnd - radius, floor + radius, radius, 270)),
    ];
    return { uStart, uEnd, points };
  }
}
