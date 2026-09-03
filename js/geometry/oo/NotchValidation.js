// Pure validation for a Notch — surfaced as a warning + "ajuster
// automatiquement" button in the UI, never a silent clamp.
import { heightProfile, junctionExclusionRanges } from '../../model/GridQuery.js';
import { t } from '../../i18n/index.js';

/** @param {object[]} [siblings] the piece's OTHER notches (not this one),
 *  for the pairwise-overlap check below — a piece can have several
 *  (Notch.listFor), and two overlapping ranges would otherwise silently
 *  pick an arbitrary winner in Edge.points()'s boundary+override lookup
 *  rather than erroring. */
export function validateNotch(run, grid, project, notch, siblings = []) {
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

  if (widthMm > 0 && offsetMm >= 0 && uEnd > run.length + 1e-6) {
    problems.push(t('validation.notch.overflowsRun', { length: run.length.toFixed(1) }));
  }

  const spans = heightProfile(run, grid, project);
  const containingSpan = spans.find((s) => s.uStart <= offsetMm + 1e-6 && s.uEnd >= uEnd - 1e-6);
  const localHeight = containingSpan ? containingSpan.height : Math.min(...spans.map((s) => s.height));
  if (!containingSpan && widthMm > 0 && offsetMm >= 0 && uEnd <= run.length + 1e-6) {
    problems.push(t('validation.notch.crossesHeightChange'));
  }
  if (depthMm > 0 && depthMm >= localHeight) {
    problems.push(t('validation.notch.depthExceedsHeight', { height: localHeight }));
  }

  const exclusions = junctionExclusionRanges(run, grid, project);
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
    maxWidthMm: run.length,
    maxOffsetMm: Math.max(0, run.length - widthMm),
    maxRadiusMm: radiusCap,
  };
}
