// Pure validation for a user-placed Hole — surfaced as a warning +
// "ajuster automatiquement" button in the UI, same pattern as
// NotchValidation. Two rules only: at least MIN_EDGE_MARGIN_MM from the
// piece's own NOMINAL (untoothed) rectangle on every side, and no overlap
// between two holes on the same piece. Deliberately does NOT check overlap
// against structural cuts (mortise holes, divider finger holes, crossing
// notches, grip notches) — out of scope, not asked for.
//
// validateHoleInRect is generic to any flat rectangular piece region (base
// plate, lid, and their drawer equivalents, all a fixed W×D rectangle);
// validateWallHole wraps it for a wall edge, whose local height can vary
// along its length. See NotchValidation.js's own comment on reusing
// PanelBuilder.js's pure heightProfile/heightAt during the migration.
import { heightProfile, heightAt } from '../PanelBuilder.js';
import { t } from '../../i18n/index.js';

const MIN_EDGE_MARGIN_MM = 2;

export function validateHoleInRect(rectWidthMm, rectHeightMm, hole, siblings = []) {
  const problems = [];
  const { xMm, yMm, widthMm, heightMm } = hole;

  if (!(widthMm > 0)) problems.push(t('validation.hole.xPositive'));
  if (!(heightMm > 0)) problems.push(t('validation.hole.yPositive'));

  const radiusCap = hole.maxRadiusMm();
  if ((hole.radiusMm || 0) > radiusCap + 1e-9) {
    problems.push(t('validation.hole.radiusTooBig', { cap: radiusCap.toFixed(1) }));
  }

  if (widthMm > 0 && heightMm > 0) {
    if (xMm < MIN_EDGE_MARGIN_MM - 1e-9) problems.push(t('validation.hole.tooCloseLeft', { margin: MIN_EDGE_MARGIN_MM }));
    if (yMm < MIN_EDGE_MARGIN_MM - 1e-9) problems.push(t('validation.hole.tooCloseBottom', { margin: MIN_EDGE_MARGIN_MM }));
    if (xMm + widthMm > rectWidthMm - MIN_EDGE_MARGIN_MM + 1e-9) problems.push(t('validation.hole.tooCloseRight', { margin: MIN_EDGE_MARGIN_MM }));
    if (yMm + heightMm > rectHeightMm - MIN_EDGE_MARGIN_MM + 1e-9) problems.push(t('validation.hole.tooCloseTop', { margin: MIN_EDGE_MARGIN_MM }));
  }

  if (siblings.some((s) => xMm < s.xMm + s.widthMm && xMm + widthMm > s.xMm && yMm < s.yMm + s.heightMm && yMm + heightMm > s.yMm)) {
    problems.push(t('validation.hole.overlapsSibling'));
  }

  return {
    ok: problems.length === 0,
    problems,
    minXMm: MIN_EDGE_MARGIN_MM,
    minYMm: MIN_EDGE_MARGIN_MM,
    maxXMm: Math.max(MIN_EDGE_MARGIN_MM, rectWidthMm - MIN_EDGE_MARGIN_MM - widthMm),
    maxYMm: Math.max(MIN_EDGE_MARGIN_MM, rectHeightMm - MIN_EDGE_MARGIN_MM - heightMm),
    maxWidthMm: Math.max(1, rectWidthMm - 2 * MIN_EDGE_MARGIN_MM),
    maxHeightMm: Math.max(1, rectHeightMm - 2 * MIN_EDGE_MARGIN_MM),
    maxRadiusMm: radiusCap,
  };
}

export function validateWallHole(run, grid, project, hole, siblings = []) {
  const spans = heightProfile(run, grid, project);
  const { xMm, widthMm } = hole;
  const xEnd = xMm + widthMm;
  const containingSpan = spans.find((s) => s.uStart <= xMm + 1e-6 && s.uEnd >= xEnd - 1e-6);
  const localHeight = containingSpan ? containingSpan.height : heightAt(spans, xMm);

  const result = validateHoleInRect(run.length, localHeight, hole, siblings);
  if (!containingSpan && widthMm > 0) {
    result.ok = false;
    result.problems = [...result.problems, t('validation.hole.crossesHeightChange')];
  }
  return result;
}
