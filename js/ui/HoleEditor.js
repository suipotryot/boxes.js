// The "trous" (holes) editor — shown in the same sidebar as
// SegmentInspector's segment/grip-notch fields, for whichever piece is
// currently selected (SegmentInspector.js resolves it via
// PieceContext.resolvePieceHoleContext, which — unlike the grip-notch
// resolver — also covers the base plate/lid and their drawer equivalents,
// since a hole is never anchored to an edge the way a grip notch is: both
// x and y are entirely free, so it applies to any flat piece). A piece can
// have SEVERAL holes, stored as a list (project.pieceHoles[pieceId],
// Hole.holeListFor) — same list-of-removable-items UI as GripNotchEditor.js,
// down to the shared trashIcon() and the one-line-per-item CSV field
// (deliberately compact and copy/paste-able to duplicate a hole). Each row
// is just that field plus a trash button — the piece preview itself is
// built once, in SegmentInspector.js, and shown at the top of the panel
// rather than duplicated per section.
import { el } from './dom.js';
import { infoIcon, trashIcon } from './fields.js';
import { DEFAULT_HOLE, maxRadiusMm, holeListFor, formatHoleLine, parseHoleLine, setHoleAt } from '../geometry/Hole.js';
import { validateHoleInRect, validateWallHole } from '../geometry/HoleValidation.js';
import { t } from '../i18n/index.js';

function validateHole(context, hole, siblings) {
  return context.kind === 'wall'
    ? validateWallHole(context.run, context.grid, context.project, hole, siblings)
    : validateHoleInRect(context.widthMm, context.heightMm, hole, siblings);
}

function renderOneHole(hole, siblings, context, onUpdate, onRemove) {
  const lineField = el('label', { class: 'field' }, [
    el('input', {
      type: 'text', value: formatHoleLine(hole),
      onChange: (evt) => {
        const parsed = parseHoleLine(evt.target.value);
        if (!parsed) { evt.target.classList.add('invalid-input'); return; } // texte illisible : ni perdu, ni appliqué tel quel
        evt.target.classList.remove('invalid-input');
        onUpdate(parsed);
      },
    }),
  ]);

  const trashBtn = el('button', {
    class: 'icon-btn', title: t('hole.delete'), 'aria-label': t('hole.delete'),
    onClick: onRemove,
  }, [trashIcon()]);

  const row = el('div', { class: 'compact-item-row' }, [lineField, trashBtn]);

  const validation = validateHole(context, hole, siblings);
  const warning = !validation.ok ? el('div', { class: 'field' }, [
    ...validation.problems.map((msg) => el('span', { class: 'warning', text: msg })),
    el('button', {
      class: 'btn', text: t('shared.autoFix'),
      onClick: () => {
        const widthMm = Math.max(1, Math.min(hole.widthMm, validation.maxWidthMm));
        const heightMm = Math.max(1, Math.min(hole.heightMm, validation.maxHeightMm));
        const refit = validateHole(context, { ...hole, widthMm, heightMm }, siblings);
        const xMm = Math.min(Math.max(hole.xMm, refit.minXMm), refit.maxXMm);
        const yMm = Math.min(Math.max(hole.yMm, refit.minYMm), refit.maxYMm);
        const radiusMm = Math.min(hole.radiusMm, maxRadiusMm({ widthMm, heightMm }));
        onUpdate({ xMm, yMm, widthMm, heightMm, radiusMm });
      },
    }),
  ]) : null;

  return el('div', { class: 'compact-item' }, [row, warning]);
}

export function renderHoleSection(project, pieceId, context, store) {
  const holes = holeListFor(project.pieceHoles, pieceId);

  const setList = (nextList) => store.apply((p) => ({
    ...p,
    pieceHoles: { ...p.pieceHoles, [pieceId]: nextList },
  }));
  const updateAt = (index, patch) => store.apply((p) => ({ ...p, pieceHoles: setHoleAt(p.pieceHoles, pieceId, index, patch) }));
  const removeAt = (index) => setList(holeListFor(project.pieceHoles, pieceId).filter((_, i) => i !== index));
  const addHole = () => setList([...holes, { ...DEFAULT_HOLE }]);

  const sectionLabel = el('div', { class: 'field-label' }, [
    t('hole.title'),
    infoIcon(t('hole.help')),
  ]);

  const fieldOrderHint = el('div', {
    class: 'hint',
    text: t('hole.fieldOrderHint'),
  });

  const dragHint = el('div', { class: 'hint', text: t('hole.dragHint') });

  const items = holes.map((hole, index) => {
    const siblings = holes.filter((_, i) => i !== index);
    return renderOneHole(hole, siblings, context, (patch) => updateAt(index, patch), () => removeAt(index));
  });

  const addBtn = el('button', { class: 'btn', text: t('hole.add'), onClick: addHole });

  return el('div', { class: 'inspector-section' }, [sectionLabel, fieldOrderHint, dragHint, ...items, addBtn]);
}
