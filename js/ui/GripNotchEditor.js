// The "encoche pour doigt" (grip notch) editor — shown in the same sidebar
// as SegmentInspector's segment fields, for whichever wall piece is
// currently selected (SegmentInspector.js resolves it via
// PieceContext.resolveWallRunContext, which is the only path that also
// reaches a drawer sleeve's own walls — they have no grid cell of their
// own to click). One shape family (see GripNotch.js): width x depth,
// offset from the run's own left end, and a corner radius from 0 (sharp)
// up to its own geometric max — no separate shape toggle.
import { el } from './dom.js';
import { infoIcon, numberField } from './fields.js';
import { DEFAULT_GRIP_NOTCH, maxRadiusMm } from '../geometry/GripNotch.js';
import { validateGripNotch } from '../geometry/GripNotchValidation.js';
import { buildWallPanel } from '../geometry/PanelBuilder.js';
import { burnCorrect } from '../geometry/BurnCorrection.js';
import { pieceToStandaloneSvg, pieceLabel } from '../geometry/SvgPath.js';

// numberField's own guard requires n > 0 (correct for width/depth), but
// offset=0 (flush against the run's own left end) and radius=0 (sharp
// corners — the natural default) are both legitimate values here; a small
// local variant rather than loosening the shared helper for its many other
// call sites, which all genuinely need a strictly-positive guard.
function nonNegativeField(labelText, value, onChange, step, tooltip) {
  return el('label', { class: 'field' }, [
    el('span', { class: 'field-label' }, [labelText, infoIcon(tooltip)]),
    el('input', {
      type: 'number', step, min: '0', value: String(value),
      onChange: (evt) => {
        const n = Number(evt.target.value);
        if (Number.isFinite(n) && n >= 0) onChange(n);
      },
    }),
  ]);
}

export function renderGripNotchSection(project, pieceId, context, store) {
  const stored = (project.pieceNotches && project.pieceNotches[pieceId]) || DEFAULT_GRIP_NOTCH;

  const updateNotch = (patch) => store.apply((p) => ({
    ...p,
    pieceNotches: {
      ...p.pieceNotches,
      [pieceId]: { ...((p.pieceNotches && p.pieceNotches[pieceId]) || DEFAULT_GRIP_NOTCH), ...patch },
    },
  }));

  const enabledRow = el('label', { class: 'field lid-enabled' }, [
    el('input', {
      type: 'checkbox', checked: stored.enabled,
      onChange: (evt) => updateNotch({ enabled: evt.target.checked }),
    }),
    el('span', { text: ' Encoche pour doigt' }),
    infoIcon('Découpe une encoche dans le bord haut (libre) de ce pan, pour pouvoir y passer les doigts — par exemple pour ouvrir une boîte en tiroir.'),
  ]);

  // Built from the REAL pipeline (buildWallPanel, burn-corrected) — both
  // for the heading's label text (correct thicknessGroup, unlike a
  // hand-built fake piece) and for the visual below when enabled. This is
  // deliberately the actual piece the laser would cut, not an
  // approximation — what you see here IS what gets exported.
  const piece = burnCorrect(buildWallPanel(context.run, context.grid, context.project, true), context.project.burnMm);
  const heading = el('h3', { text: pieceLabel(piece) || pieceId });

  if (!stored.enabled) {
    return el('div', { class: 'inspector-section' }, [heading, enabledRow]);
  }

  const validation = validateGripNotch(context.run, context.grid, context.project, stored);

  const widthField = numberField('Largeur (mm)', stored.widthMm, (n) => updateNotch({ widthMm: n }), '0.5',
    'Largeur de l’encoche, le long du pan.');
  const depthField = numberField('Profondeur (mm)', stored.depthMm, (n) => updateNotch({ depthMm: n }), '0.5',
    'Profondeur de l’encoche, depuis le bord du pan.');
  const radiusField = nonNegativeField('Rayon des coins (mm)', stored.radiusMm, (n) => updateNotch({ radiusMm: n }), '0.5',
    'Rayon d’arrondi des 2 coins du fond de l’encoche — 0 = coins carrés (fond plat), jusqu’à min(largeur/2, profondeur) pour un fond en demi-cercle complet.');
  const offsetField = nonNegativeField('Position depuis le bord gauche (mm)', stored.offsetMm, (n) => updateNotch({ offsetMm: n }), '0.5',
    'Distance entre l’extrémité gauche du pan (là où il rejoint le pan voisin) et le bord gauche de l’encoche.');

  const warning = !validation.ok ? el('div', { class: 'field' }, [
    ...validation.problems.map((msg) => el('span', { class: 'warning', text: msg })),
    el('button', {
      class: 'btn', text: 'Ajuster automatiquement',
      onClick: () => {
        const widthMm = Math.max(1, Math.min(stored.widthMm, validation.maxWidthMm));
        const depthMm = Math.min(stored.depthMm, Math.max(1, validation.localHeight - 1));
        const offsetMm = Math.min(Math.max(stored.offsetMm, 0), Math.max(0, context.run.length - widthMm));
        const radiusMm = Math.min(stored.radiusMm, maxRadiusMm({ widthMm, depthMm }));
        updateNotch({ widthMm, offsetMm, depthMm, radiusMm });
      },
    }),
  ]) : null;

  const visual = el('div', { class: 'preview-card grip-notch-visual' }, [
    pieceToStandaloneSvg(piece, { padding: 8, minSize: 260, showLabels: false }),
  ]);

  return el('div', { class: 'inspector-section' }, [
    heading, enabledRow, widthField, depthField, radiusField, offsetField, warning, visual,
  ]);
}
