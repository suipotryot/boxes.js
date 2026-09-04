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
import { Cutout } from '../geometry/oo/Cutout.js';
import { Hole, DEFAULT_HOLE } from '../geometry/oo/Hole.js';
import { validateHoleInRect, validateWallHole, wallHoleSpan } from '../geometry/oo/HoleValidation.js';
import { centerHolesOnX, centerHolesOnY, distributeHolesOnX, distributeHolesOnY } from '../geometry/oo/HoleAlignment.js';
import { t } from '../i18n/index.js';

function validateHole(context, hole, siblings) {
  return context.kind === 'wall'
    ? validateWallHole(context.run, context.grid, context.project, hole, siblings)
    : validateHoleInRect(context.widthMm, context.heightMm, hole, siblings);
}

function renderOneHole(hole, siblings, context, onUpdate, onRemove) {
  const lineField = el('label', { class: 'field' }, [
    el('input', {
      type: 'text', value: hole.toTextLine(),
      onChange: (evt) => {
        const parsed = Hole.fromTextLine(evt.target.value);
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
        const refit = validateHole(context, hole.withChanges({ widthMm, heightMm }), siblings);
        const xMm = Math.min(Math.max(hole.xMm, refit.minXMm), refit.maxXMm);
        const yMm = Math.min(Math.max(hole.yMm, refit.minYMm), refit.maxYMm);
        const radiusMm = Math.min(hole.radiusMm, hole.withChanges({ widthMm, heightMm }).maxRadiusMm());
        onUpdate({ xMm, yMm, widthMm, heightMm, radiusMm });
      },
    }),
  ]) : null;

  return el('div', { class: 'compact-item' }, [row, warning]);
}

export function renderHoleSection(project, pieceId, context, store, selectedIndex) {
  const holes = Hole.listFor(project.pieceHoles, pieceId);

  const setList = (nextList) => store.apply((p) => ({
    ...p,
    pieceHoles: { ...p.pieceHoles, [pieceId]: nextList },
  }));
  const updateAt = (index, patch) => setList(Cutout.replaceAt(Hole.listFor(project.pieceHoles, pieceId), index, patch));
  const removeAt = (index) => setList(Hole.listFor(project.pieceHoles, pieceId).filter((_, i) => i !== index));
  const addHole = () => setList([...holes, new Hole(DEFAULT_HOLE)]);

  const sectionLabel = el('div', { class: 'field-label' }, [
    t('hole.title'),
    infoIcon(t('hole.help')),
  ]);

  const fieldOrderHint = el('div', {
    class: 'hint',
    text: t('hole.fieldOrderHint'),
  });

  const dragHint = el('div', { class: 'hint', text: t('hole.dragHint') });

  const availableWidthMm = context.kind === 'flat' ? context.widthMm : context.run.length;
  // On a wall, local height can step along its length (a T-junction stub),
  // so each hole centers against ITS OWN local height rather than a value
  // shared across the group — consistent with centering treating every
  // hole independently (see HoleAlignment.js).
  const availableHeightMm = context.kind === 'flat'
    ? context.heightMm
    : (h) => wallHoleSpan(context.run, context.grid, context.project, h).height;

  // Centrer acts on the ONE selected hole only (see SegmentInspector.js's
  // selectedCutout) — reusing centerHolesOnX/Y on a single-element array
  // needs no change to those functions, since centering is already
  // per-hole-independent. Distribuer is unaffected by selection: it
  // inherently needs the whole group (sorting, spacing), so restricting it
  // to "just the selected one" wouldn't mean anything.
  const alignRow = el('div', { class: 'button-row' }, [
    el('button', {
      class: 'btn', text: t('hole.centerX'), disabled: selectedIndex == null,
      onClick: () => {
        const [centered] = centerHolesOnX([holes[selectedIndex]], availableWidthMm);
        updateAt(selectedIndex, { xMm: centered.xMm });
      },
    }),
    el('button', {
      class: 'btn', text: t('hole.centerY'), disabled: selectedIndex == null,
      onClick: () => {
        const [centered] = centerHolesOnY([holes[selectedIndex]], availableHeightMm);
        updateAt(selectedIndex, { yMm: centered.yMm });
      },
    }),
    el('button', { class: 'btn', text: t('hole.distributeX'), disabled: holes.length < 3, onClick: () => setList(distributeHolesOnX(holes)) }),
    el('button', { class: 'btn', text: t('hole.distributeY'), disabled: holes.length < 3, onClick: () => setList(distributeHolesOnY(holes)) }),
  ]);

  const items = holes.map((hole, index) => {
    const siblings = holes.filter((_, i) => i !== index);
    return renderOneHole(hole, siblings, context, (patch) => updateAt(index, patch), () => removeAt(index));
  });

  const addBtn = el('button', { class: 'btn', text: t('hole.add'), onClick: addHole });

  return el('div', { class: 'inspector-section' }, [sectionLabel, fieldOrderHint, dragHint, alignRow, ...items, addBtn]);
}
