// Pure validation for a user-placed hole (Hole.js) — surfaced as a warning
// + "ajuster automatiquement" button in the UI, same pattern as
// GripNotchValidation. Two rules only, exactly what the user asked for:
// at least MIN_EDGE_MARGIN_MM from the piece's own NOMINAL (untoothed)
// rectangle on every side, and no overlap between two holes on the same
// piece. Deliberately does NOT check overlap against structural cuts
// (mortise holes, divider finger holes, X-crossing notches, grip
// notches) — out of scope, not asked for.
//
// validateHoleInRect is generic to any flat rectangular piece region
// (base plate, lid, and their drawer equivalents, all a fixed W×D
// rectangle); validateWallHole wraps it for a wall run, whose local
// height can vary along its length (heightProfile/heightAt, imported
// from PanelBuilder.js exactly as GripNotchValidation.js already does).
import { heightProfile, heightAt } from './PanelBuilder.js';
import { maxRadiusMm } from './Hole.js';

const MIN_EDGE_MARGIN_MM = 2;

export function validateHoleInRect(rectWidthMm, rectHeightMm, hole, siblings = []) {
  const problems = [];
  const { xMm, yMm, widthMm, heightMm } = hole;

  if (!(widthMm > 0)) problems.push('La dimension X doit être positive.');
  if (!(heightMm > 0)) problems.push('La dimension Y doit être positive.');

  const radiusCap = maxRadiusMm(hole);
  if ((hole.radiusMm || 0) > radiusCap + 1e-9) {
    problems.push(`Le rayon des coins ne peut pas dépasser ${radiusCap.toFixed(1)}mm (la moitié de la plus petite dimension).`);
  }

  if (widthMm > 0 && heightMm > 0) {
    if (xMm < MIN_EDGE_MARGIN_MM - 1e-9) problems.push(`Le trou doit rester à au moins ${MIN_EDGE_MARGIN_MM}mm du bord gauche.`);
    if (yMm < MIN_EDGE_MARGIN_MM - 1e-9) problems.push(`Le trou doit rester à au moins ${MIN_EDGE_MARGIN_MM}mm du bord bas.`);
    if (xMm + widthMm > rectWidthMm - MIN_EDGE_MARGIN_MM + 1e-9) problems.push(`Le trou doit rester à au moins ${MIN_EDGE_MARGIN_MM}mm du bord droit.`);
    if (yMm + heightMm > rectHeightMm - MIN_EDGE_MARGIN_MM + 1e-9) problems.push(`Le trou doit rester à au moins ${MIN_EDGE_MARGIN_MM}mm du bord haut.`);
  }

  if (siblings.some((s) => xMm < s.xMm + s.widthMm && xMm + widthMm > s.xMm && yMm < s.yMm + s.heightMm && yMm + heightMm > s.yMm)) {
    problems.push('Ce trou chevauche un autre trou de la même pièce — repositionnez-le ou repositionnez l\'autre.');
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
    result.problems = [...result.problems, 'Le trou chevauche une variation de hauteur le long du pan — repositionnez-le dans une zone de hauteur uniforme.'];
  }
  return result;
}
