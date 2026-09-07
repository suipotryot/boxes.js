// Pure validation for a Notch — surfaced as a warning + "ajuster
// automatiquement" button in the UI, never a silent clamp.
//
// validateNotchCore is generic to any edge with a length, a (possibly
// stepped) height/cap profile and a set of no-go u-ranges — the same
// wall/flat split as HoleValidation.js's validateHoleInRect/validateWallHole:
// validateNotch wraps it for a wall run (spans/exclusions read straight off
// the grid, exactly as before); validateFlatEdgeNotch wraps it for a flat
// panel's own open (smooth) edge, whose "how deep can this cut go" cap is a
// single constant (the panel's own perpendicular extent) rather than a
// stepped profile, and which never has a mid-run junction to exclude.
import { heightProfile, junctionExclusionRanges } from '../../model/GridQuery.js';
import { t } from '../../i18n/index.js';

/** @param {object[]} [siblings] the piece's OTHER notches (not this one),
 *  for the pairwise-overlap check below — a piece can have several
 *  (Notch.listFor), and two overlapping ranges would otherwise silently
 *  pick an arbitrary winner in Edge.points()'s boundary+override lookup
 *  rather than erroring. */
function validateNotchCore(lengthMm, spans, exclusions, notch, siblings = []) {
  if (!notch) return { ok: true, problems: [] };

  const problems = [];
  const { widthMm, offsetMm, depthMm } = notch;
  const uEnd = offsetMm + widthMm;

  if (!(widthMm > 0)) problems.push(t('validation.widthPositive'));
  if (!(depthMm > 0)) problems.push(t('validation.depthPositive'));
  if (!(offsetMm >= 0)) problems.push(t('validation.offsetNotNegative'));

  const radiusCap = notch.maxRadiusMm();
  if ((notch.radiusMm || 0) > radiusCap + 1e-9) {
    problems.push(t('validation.notch.radiusTooBig', { cap: radiusCap.toFixed(1) }));
  }

  if (widthMm > 0 && offsetMm >= 0 && uEnd > lengthMm + 1e-6) {
    problems.push(t('validation.notch.overflowsRun', { length: lengthMm.toFixed(1) }));
  }

  const containingSpan = spans.find((s) => s.uStart <= offsetMm + 1e-6 && s.uEnd >= uEnd - 1e-6);
  const localHeight = containingSpan ? containingSpan.height : Math.min(...spans.map((s) => s.height));
  if (!containingSpan && widthMm > 0 && offsetMm >= 0 && uEnd <= lengthMm + 1e-6) {
    problems.push(t('validation.notch.crossesHeightChange'));
  }
  if (depthMm > 0 && depthMm >= localHeight) {
    problems.push(t('validation.notch.depthExceedsHeight', { height: localHeight }));
  }

  if (exclusions.some((ex) => offsetMm < ex.uEnd && uEnd > ex.uStart)) {
    problems.push(t('validation.notch.crossesJunction'));
  }

  if (siblings.some((s) => offsetMm < s.offsetMm + s.widthMm && uEnd > s.offsetMm)) {
    problems.push(t('validation.notch.overlapsSibling'));
  }

  return {
    ok: problems.length === 0,
    problems,
    localHeight,
    maxWidthMm: lengthMm,
    maxOffsetMm: Math.max(0, lengthMm - widthMm),
    maxRadiusMm: radiusCap,
  };
}

export function validateNotch(run, grid, project, notch, siblings = []) {
  if (!notch) return { ok: true, problems: [] };
  return validateNotchCore(run.length, heightProfile(run, grid, project), junctionExclusionRanges(run, grid, project), notch, siblings);
}

/** `capMm` is the flat edge's own perpendicular extent (e.g. a base
 *  plate/lid's depthMm for its top/bottom edges, widthMm for its
 *  left/right edges) — the material budget a notch cuts into, constant
 *  along the whole edge (a flat panel has no stepped height profile the
 *  way a wall run can). No junction exclusions: an open flat-panel edge
 *  never has a mid-run T/X junction crossing it. */
export function validateFlatEdgeNotch(lengthMm, capMm, notch, siblings = []) {
  if (!notch) return { ok: true, problems: [] };
  return validateNotchCore(lengthMm, [{ uStart: 0, uEnd: lengthMm, height: capMm }], [], notch, siblings);
}
