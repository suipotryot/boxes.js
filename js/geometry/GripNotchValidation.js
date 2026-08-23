// Pure validation for a grip notch (GripNotch.js) — surfaced as a warning +
// "ajuster automatiquement" button in the UI, never a silent clamp, same
// pattern as GridQuery.validateLid. A separate file from GripNotch.js (not
// merged into it) to avoid a module cycle: PanelBuilder.js imports
// GripNotch.js (pure math, no deps), while this file imports FROM
// PanelBuilder.js (heightProfile/junctionExclusionRanges) — keeping the
// graph one-directional.
import { heightProfile, junctionExclusionRanges } from './PanelBuilder.js';
import { maxRadiusMm } from './GripNotch.js';

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

  if (!(widthMm > 0)) problems.push('La largeur doit être positive.');
  if (!(depthMm > 0)) problems.push('La profondeur doit être positive.');
  if (!(offsetMm >= 0)) problems.push('La position ne peut pas être négative.');

  const radiusCap = maxRadiusMm(notch);
  if ((notch.radiusMm || 0) > radiusCap + 1e-9) {
    problems.push(`Le rayon des coins ne peut pas dépasser ${radiusCap.toFixed(1)}mm (la moitié de la largeur, ou la profondeur si elle est plus petite).`);
  }

  if (widthMm > 0 && offsetMm >= 0 && uEnd > run.length + 1e-6) {
    problems.push(`L'encoche dépasse l'extrémité du pan (largeur + position ≤ ${run.length.toFixed(1)}mm).`);
  }

  const spans = heightProfile(run, grid, project);
  const containingSpan = spans.find((s) => s.uStart <= offsetMm + 1e-6 && s.uEnd >= uEnd - 1e-6);
  const localHeight = containingSpan ? containingSpan.height : Math.min(...spans.map((s) => s.height));
  if (!containingSpan && widthMm > 0 && offsetMm >= 0 && uEnd <= run.length + 1e-6) {
    problems.push('L\'encoche chevauche une variation de hauteur le long du pan — repositionnez-la dans une zone de hauteur uniforme.');
  }
  if (depthMm > 0 && depthMm >= localHeight) {
    problems.push(`La profondeur doit être inférieure à la hauteur locale du pan à cet endroit (${localHeight}mm).`);
  }

  const exclusions = junctionExclusionRanges(run, grid, project);
  if (exclusions.some((ex) => offsetMm < ex.uEnd && uEnd > ex.uStart)) {
    problems.push('L\'encoche chevauche une jonction (entaille en croix ou mortaise) sur ce pan — repositionnez-la.');
  }

  if (siblings.some((s) => offsetMm < s.offsetMm + s.widthMm && uEnd > s.offsetMm)) {
    problems.push('Cette encoche chevauche une autre encoche du même pan — repositionnez-la ou repositionnez l\'autre.');
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
