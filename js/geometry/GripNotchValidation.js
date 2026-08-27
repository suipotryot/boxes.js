// Pure validation for a grip notch (GripNotch.js) — surfaced as a warning +
// "ajuster automatiquement" button in the UI, never a silent clamp, same
// pattern as GridQuery.validateLid. A separate file from GripNotch.js (not
// merged into it) to avoid a module cycle: PanelBuilder.js imports
// GripNotch.js (pure math, no deps), while this file imports FROM
// PanelBuilder.js (heightProfile/junctionExclusionRanges) — keeping the
// graph one-directional.
import { heightProfile, junctionExclusionRanges } from './PanelBuilder.js';
import { maxRadiusMm } from './GripNotch.js';
// A rare dependency from geometry/ (otherwise pure math, no UI/state
// imports) on the i18n singleton — these problem messages are shown
// verbatim in GripNotchEditor.js, so they need to be in the active
// locale too. t() defaults to 'fr' until something calls setActiveLocale
// (AppShell.js, at startup), which is also why the existing French-text
// assertions in js/test/gripNotch.test.js keep passing unmodified: that
// test never touches locale, so it only ever sees the 'fr' dictionary.
import { t } from '../i18n/index.js';

/** @param {object[]} [siblings] the piece's OTHER grip notches (not this
 *  one), for the pairwise-overlap check below — a piece can now have
 *  several (GripNotch.notchListFor), and two overlapping ranges would
 *  otherwise silently pick an arbitrary winner in PanelBuilder's
 *  boundarySet+override lookup rather than erroring. */
export function validateGripNotch(run, grid, project, notch, siblings = []) {
  if (!notch) return { ok: true, problems: [] };

  const problems = [];
  const { widthMm, offsetMm, depthMm } = notch;
  const uEnd = offsetMm + widthMm;

  if (!(widthMm > 0)) problems.push(t('validation.widthPositive'));
  if (!(depthMm > 0)) problems.push(t('validation.depthPositive'));
  if (!(offsetMm >= 0)) problems.push(t('validation.offsetNotNegative'));

  const radiusCap = maxRadiusMm(notch);
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
