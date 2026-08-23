// Pure validation for a grip notch (GripNotch.js) — surfaced as a warning +
// "ajuster automatiquement" button in the UI, never a silent clamp, same
// pattern as GridQuery.validateLid. A separate file from GripNotch.js (not
// merged into it) to avoid a module cycle: PanelBuilder.js imports
// GripNotch.js (pure math, no deps), while this file imports FROM
// PanelBuilder.js (heightProfile/junctionExclusionRanges) — keeping the
// graph one-directional.
import { heightProfile, junctionExclusionRanges } from './PanelBuilder.js';
import { maxRadiusMm } from './GripNotch.js';

export function validateGripNotch(run, grid, project, notch) {
  if (!notch || !notch.enabled) return { ok: true, problems: [] };

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

  return {
    ok: problems.length === 0,
    problems,
    localHeight,
    maxWidthMm: run.length,
    maxOffsetMm: Math.max(0, run.length - widthMm),
    maxRadiusMm: radiusCap,
  };
}
