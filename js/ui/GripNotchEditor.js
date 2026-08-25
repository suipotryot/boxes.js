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
// (copy the line, paste it into a new one, just change the position). Each
// row is just that field plus a trash button (no per-row heading/tooltip)
// — the field order is explained once, above the whole list, instead of
// repeated per row; the piece preview itself is rendered once, at the top
// of SegmentInspector's panel, not duplicated here.
import { el } from './dom.js';
import { infoIcon, trashIcon } from './fields.js';
import { DEFAULT_GRIP_NOTCH, maxRadiusMm, notchListFor, formatNotchLine, parseNotchLine } from '../geometry/GripNotch.js';
import { validateGripNotch } from '../geometry/GripNotchValidation.js';

function renderOneNotch(notch, siblings, context, onUpdate, onRemove) {
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

  const trashBtn = el('button', {
    class: 'icon-btn', title: 'Supprimer cette encoche', 'aria-label': 'Supprimer cette encoche',
    onClick: onRemove,
  }, [trashIcon()]);

  const row = el('div', { class: 'compact-item-row' }, [lineField, trashBtn]);

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

  return el('div', { class: 'compact-item' }, [row, warning]);
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

  const sectionLabel = el('div', { class: 'field-label' }, [
    'Encoches pour doigt',
    infoIcon('Découpe une ou plusieurs encoches dans le bord haut (libre) de ce pan, pour pouvoir y passer les doigts — par exemple pour ouvrir une boîte en tiroir.'),
  ]);

  const fieldOrderHint = el('div', {
    class: 'hint',
    text: 'Largeur, profondeur, rayon, position (mm), séparés par des virgules — le point sépare les décimales, ex. « 20.5, 8, 0, 10 ».',
  });

  const items = notches.map((notch, index) => {
    const siblings = notches.filter((_, i) => i !== index);
    return renderOneNotch(notch, siblings, context, (patch) => updateAt(index, patch), () => removeAt(index));
  });

  const addBtn = el('button', { class: 'btn', text: '+ Ajouter une encoche', onClick: addNotch });

  return el('div', { class: 'inspector-section' }, [sectionLabel, fieldOrderHint, ...items, addBtn]);
}
