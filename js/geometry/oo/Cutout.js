// Shared base for user-placed cut features (Notch, Hole): corner-radius
// clamping, the arc-fillet math both use, and the strict-reject number-line
// parsing both use for their copy/paste-able text field. How a Cutout
// integrates into a Piece (spliced into the outline vs. a separate closed
// polygon) is deliberately NOT shared here — that's a real physical
// difference, not just unfactored code (see Notch.js/Hole.js).
export const ARC_SEGMENTS_PER_CORNER = 8; // 9 points per fully-rounded corner

/** `segments` quarter-circle arc points around (cx,cy), starting at
 *  `startDeg` (standard math convention: 0=right, 90=up, going
 *  counter-clockwise) and sweeping 90 degrees. */
export function arcPoints(cx, cy, radiusMm, startDeg, segments = ARC_SEGMENTS_PER_CORNER) {
  const points = [];
  for (let i = 0; i <= segments; i++) {
    const rad = ((startDeg + (90 * i) / segments) * Math.PI) / 180;
    points.push({ x: cx + radiusMm * Math.cos(rad), y: cy + radiusMm * Math.sin(rad) });
  }
  return points;
}

export class Cutout {
  constructor(radiusMm) {
    this.radiusMm = radiusMm;
  }

  maxRadiusMm() {
    throw new Error('Cutout.maxRadiusMm must be implemented by a subclass');
  }

  /** This cutout's own radius, clamped into [0, maxRadiusMm()] — never
   *  trusts a stored/typed value to already be in range. */
  clampedRadiusMm() {
    return Math.min(Math.max(this.radiusMm || 0, 0), this.maxRadiusMm());
  }

  /** A new instance of the SAME concrete subclass, with `patch` merged
   *  over this instance's own fields — relies on every subclass's
   *  constructor accepting a plain object shaped exactly like its own
   *  fields (true for Notch and Hole). */
  withChanges(patch) {
    return new this.constructor({ ...this, ...patch });
  }

  /** Replaces the item at `index` in `list` with itself merged with
   *  `patch`, leaving every other item (and `list` itself) untouched —
   *  shared by both a text-field editor and a mouse-drag overlay so both
   *  commit through identical, tested logic. */
  static replaceAt(list, index, patch) {
    return list.map((item, i) => (i === index ? item.withChanges(patch) : item));
  }

  /** `text` split on commas, trimmed, rejected outright (returns null) if
   *  the count doesn't match exactly, any token is empty, or any token
   *  isn't a finite number — never a silent correction, never a
   *  half-parsed value applied. */
  static parseNumbers(text, count) {
    const parts = text.split(',').map((s) => s.trim());
    if (parts.length !== count || parts.some((p) => p === '')) return null;
    const nums = parts.map(Number);
    return nums.some((n) => !Number.isFinite(n)) ? null : nums;
  }
}
