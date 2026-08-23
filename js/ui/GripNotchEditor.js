// The "encoches pour doigt" (grip notches) editor — shown in the same
// sidebar as SegmentInspector's segment fields, for whichever wall piece
// is currently selected (SegmentInspector.js resolves it via
// PieceContext.resolveWallRunContext, which is the only path that also
// reaches a drawer sleeve's own walls — they have no grid cell of their
// own to click). A piece can have SEVERAL grip notches — selecting
// different grid segments of the same merged run always resolves to the
// same piece id, so a single notch per piece wasn't enough — stored as a
// list (GripNotch.notchListFor), each entry with its own trash-icon
// button; there's no per-notch enable toggle, removing it from the list IS
// disabling it. Each notch's 4 numbers (width/depth/radius/offset) are
// edited as ONE comma-separated text field rather than 4 separate inputs —
// deliberately compact, and directly copy/paste-able to duplicate a notch
// (copy the line, paste it into a new one, just change the position).
import { el } from './dom.js';
import { infoIcon, trashIcon } from './fields.js';
import { DEFAULT_GRIP_NOTCH, maxRadiusMm, notchListFor, formatNotchLine, parseNotchLine } from '../geometry/GripNotch.js';
import { validateGripNotch } from '../geometry/GripNotchValidation.js';
import { buildWallPanel } from '../geometry/PanelBuilder.js';
import { burnCorrect } from '../geometry/BurnCorrection.js';
import { pieceToStandaloneSvg, pieceLabel } from '../geometry/SvgPath.js';

function renderOneNotch(index, notch, siblings, context, onUpdate, onRemove) {
  // The field's own info icon (what each of the 4 comma-separated numbers
  // means) sits right in the header, next to "Encoche N" — rather than on
  // its own line above the input — so a notch item is 3 lines tall
  // (header, input, warning) instead of 4.
  const header = el('div', { class: 'grip-notch-header' }, [
    el('span', { class: 'field-label' }, [`Encoche ${index + 1}`, infoIcon(
      'Largeur, profondeur, rayon, position (mm) : les 4 valeurs de cette encoche, séparées par des virgules, dans cet ordre. Le point (pas la virgule) sépare les décimales — ex. « 20.5, 8, 0, 10 ».',
    )]),
    el('button', {
      class: 'icon-btn', title: 'Supprimer cette encoche', 'aria-label': 'Supprimer cette encoche',
      onClick: onRemove,
    }, [trashIcon()]),
  ]);

  const lineField = el('label', { class: 'field' }, [
    el('input', {
      type: 'text', value: formatNotchLine(notch),
      onChange: (evt) => {
        const parsed = parseNotchLine(evt.target.value);
        if (!parsed) { evt.target.classList.add('invalid-input'); return; } // texte illisible : ni perdu, ni appliqué tel quel
        evt.target.classList.remove('invalid-input');
        onUpdate(parsed);
      },
    }),
  ]);

  const validation = validateGripNotch(context.run, context.grid, context.project, notch, siblings);
  const warning = !validation.ok ? el('div', { class: 'field' }, [
    ...validation.problems.map((msg) => el('span', { class: 'warning', text: msg })),
    el('button', {
      class: 'btn', text: 'Ajuster automatiquement',
      onClick: () => {
        const widthMm = Math.max(1, Math.min(notch.widthMm, validation.maxWidthMm));
        const depthMm = Math.min(notch.depthMm, Math.max(1, validation.localHeight - 1));
        const offsetMm = Math.min(Math.max(notch.offsetMm, 0), Math.max(0, context.run.length - widthMm));
        const radiusMm = Math.min(notch.radiusMm, maxRadiusMm({ widthMm, depthMm }));
        onUpdate({ widthMm, offsetMm, depthMm, radiusMm });
      },
    }),
  ]) : null;

  return el('div', { class: 'grip-notch-item' }, [header, lineField, warning]);
}

export function renderGripNotchSection(project, pieceId, context, store) {
  const notches = notchListFor(project.pieceNotches, pieceId);

  const setList = (nextList) => store.apply((p) => ({
    ...p,
    pieceNotches: { ...p.pieceNotches, [pieceId]: nextList },
  }));
  const updateAt = (index, patch) => setList(notchListFor(project.pieceNotches, pieceId).map((n, i) => (i === index ? { ...n, ...patch } : n)));
  const removeAt = (index) => setList(notchListFor(project.pieceNotches, pieceId).filter((_, i) => i !== index));
  const addNotch = () => setList([...notches, { ...DEFAULT_GRIP_NOTCH }]);

  // Built from the REAL pipeline (buildWallPanel, burn-corrected), folding
  // in every notch currently in the list — both for the heading's label
  // text (correct thicknessGroup, unlike a hand-built fake piece) and for
  // the visual below. This is deliberately the actual piece the laser
  // would cut, not an approximation — what you see here IS what gets
  // exported.
  const piece = burnCorrect(buildWallPanel(context.run, context.grid, context.project, true), context.project.burnMm);
  const heading = el('h3', { text: pieceLabel(piece) || pieceId });

  const sectionLabel = el('div', { class: 'field-label' }, [
    'Encoches pour doigt',
    infoIcon('Découpe une ou plusieurs encoches dans le bord haut (libre) de ce pan, pour pouvoir y passer les doigts — par exemple pour ouvrir une boîte en tiroir.'),
  ]);

  const items = notches.map((notch, index) => {
    const siblings = notches.filter((_, i) => i !== index);
    return renderOneNotch(index, notch, siblings, context, (patch) => updateAt(index, patch), () => removeAt(index));
  });

  const addBtn = el('button', { class: 'btn', text: '+ Ajouter une encoche', onClick: addNotch });

  const visual = el('div', { class: 'preview-card grip-notch-visual' }, [
    pieceToStandaloneSvg(piece, { padding: 8, minSize: 260, showLabels: false }),
  ]);

  return el('div', { class: 'inspector-section' }, [heading, sectionLabel, ...items, addBtn, visual]);
}
