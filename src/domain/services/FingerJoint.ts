import type { FingerJointSettings } from '../models/Project';
import type { Rect } from '../models/types';

export type FingerSegmentKind = 'finger' | 'space' | 'flush';

/** A span along a 1D edge coordinate: `start`..`start+length`. */
export interface FingerSegment {
  start: number;
  length: number;
  kind: FingerSegmentKind;
}

/**
 * Independently-derived finger-joint tiling (not ported from boxes.py): an
 * edge is a flush margin, an alternating finger/space comb, then a flush
 * margin. The margin exists so a finger/notch never lands flush on the
 * panel's own corner; both mating edges get the *same* flush span (a flush
 * region is simply uncut material on both sides, not a joint feature), so
 * only the finger/space region needs to be complementary between two
 * mating edges of equal length.
 *
 * The finger/space count is chosen to fit the available length as evenly
 * as possible around the nominal fingerMm/spaceMm, then every segment in
 * that region is scaled proportionally so the whole edge sums to exactly
 * `length` -- no rounding slack left over.
 */
export function fingerEdgePath(length: number, settings: FingerJointSettings, startWithFinger: boolean): FingerSegment[] {
  const margin = Math.max(0, settings.edgeWidthMm + settings.surroundingSpaces * settings.spaceMm);
  const clampedMargin = Math.min(margin, length / 2);
  const innerLength = Math.max(length - 2 * clampedMargin, 0);

  const kinds = combPattern(innerLength, settings, startWithFinger);
  const nominalTotal = kinds.reduce((sum, k) => sum + nominalWidth(k, settings), 0);
  const scale = nominalTotal > 0 ? innerLength / nominalTotal : 0;

  const segments: FingerSegment[] = [];
  let cursor = 0;

  if (clampedMargin > 0) {
    segments.push({ start: 0, length: clampedMargin, kind: 'flush' });
    cursor = clampedMargin;
  }
  for (const kind of kinds) {
    const segLength = nominalWidth(kind, settings) * scale;
    segments.push({ start: cursor, length: segLength, kind });
    cursor += segLength;
  }
  if (clampedMargin > 0) {
    segments.push({ start: cursor, length: clampedMargin, kind: 'flush' });
    cursor += clampedMargin;
  }

  return segments;
}

/**
 * Positions of the finger-shaped holes to cut into a carrying wall's face
 * for a T-junction: reuses the entering wall's own comb pattern and keeps
 * the 'finger' AND 'flush' (margin) spans, since PanelBuilder.buildEndEdge
 * protrudes the entering wall's material fully through the carrying wall
 * at BOTH of those (only a genuine 'space' band retreats to the near face,
 * with nothing to cut a hole for). A carrying wall isn't itself "ending"
 * at a T-junction the way two walls both terminating into a corner are --
 * there's no complementary wall to share an unpunched margin block with --
 * so leaving 'flush' bands out of the hole set (as an earlier version of
 * this did) left the entering wall's margin material colliding with solid,
 * uncut material there instead of passing cleanly through.
 */
export function fingerHoleRow(startOffset: number, length: number, settings: FingerJointSettings, holeHeight: number): Rect[] {
  return fingerEdgePath(length, settings, true)
    .filter((segment) => segment.kind === 'finger' || segment.kind === 'flush')
    .map((segment) => ({ x: startOffset + segment.start, y: 0, width: segment.length, height: holeHeight }));
}

/**
 * Boosts `edgeWidthMm` so the margin at each end of a `fingerEdgePath` call
 * is at least `minMarginMm`, leaving everything else about the settings
 * untouched. An edge whose margin is left to the user's fingerJoint
 * settings alone can end up with a tooth closer to a corner than the
 * material is thick -- and a corner post (the interlocking tabs of a
 * *perpendicular* edge meeting that same corner, e.g. a wall's own
 * left/right compound edge, or a base plate's corner relief notch) always
 * needs exactly that much clearance to seat without colliding. Boxes.py
 * avoids this by tying its own default edge margin to material thickness;
 * this does the equivalent by clamping the *effective* margin up to
 * whatever thickness the caller says must be kept clear, regardless of the
 * user's configured edgeWidthMm/surroundingSpaces.
 */
export function withMinMargin(settings: FingerJointSettings, minMarginMm: number): FingerJointSettings {
  const currentMargin = settings.edgeWidthMm + settings.surroundingSpaces * settings.spaceMm;
  if (currentMargin >= minMarginMm) {
    return settings;
  }
  return { ...settings, edgeWidthMm: settings.edgeWidthMm + (minMarginMm - currentMargin) };
}

function combPattern(innerLength: number, settings: FingerJointSettings, startWithFinger: boolean): FingerSegmentKind[] {
  const unit = settings.fingerMm + settings.spaceMm;
  const pairCount = unit > 0 ? Math.max(1, Math.round(innerLength / unit)) : 1;
  const kinds: FingerSegmentKind[] = [];
  for (let i = 0; i < pairCount * 2; i++) {
    const isFirstOfPair = i % 2 === 0;
    kinds.push(isFirstOfPair === startWithFinger ? 'finger' : 'space');
  }
  return kinds;
}

function nominalWidth(kind: FingerSegmentKind, settings: FingerJointSettings): number {
  return kind === 'finger' ? settings.fingerMm : settings.spaceMm;
}
