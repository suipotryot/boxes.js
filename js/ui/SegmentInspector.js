// The only place that mutates a segment's present/height/group. A click on
// the editor selects a segment (see EditorView) but never mutates it
// directly — that split keeps "select" and "toggle" from being the same
// ambiguous click, and gives every mutation one clear origin to look for.
import { el } from './dom.js';
import { toggleWall, setSegmentHeight, setSegmentThicknessGroup, isOuterSegment } from '../model/Grid.js';
import { resolveHeight, resolveThickness } from '../model/GridQuery.js';

const KIND_LABEL = { v: 'vertical', h: 'horizontal' };
const GROUP_LABEL = { outer: 'Extérieur', inner: 'Intérieur' };

export function renderInspector(project, selected, store) {
  if (!selected) {
    return el('div', { class: 'inspector empty' }, [
      el('p', { text: 'Cliquez sur un segment de la grille pour l’inspecter.' }),
    ]);
  }

  const { kind, c, r } = selected;
  const grid = project.grid;
  const seg = kind === 'v' ? grid.vWalls[c][r] : grid.hWalls[c][r];
  const outer = isOuterSegment(grid, kind, c, r);
  const resolvedHeight = resolveHeight(seg, project);
  const resolvedThickness = resolveThickness(seg, project);

  const presenceRow = el('div', { class: 'field' }, [
    el('span', { class: 'field-label', text: 'État' }),
    el('button', {
      class: 'btn',
      text: seg.present ? 'Supprimer ce segment' : 'Ajouter ce segment',
      disabled: outer,
      onClick: () => store.apply((p) => ({ ...p, grid: toggleWall(p.grid, kind, c, r) })),
    }),
    outer ? el('span', { class: 'hint', text: 'Le périmètre extérieur ne peut pas être retiré.' }) : null,
  ]);

  const groupSelect = el('select', {
    disabled: outer,
    onChange: (evt) => store.apply((p) => ({ ...p, grid: setSegmentThicknessGroup(p.grid, kind, c, r, evt.target.value) })),
  }, [
    el('option', { value: 'inner', selected: seg.thicknessGroup === 'inner', text: GROUP_LABEL.inner }),
    el('option', { value: 'outer', selected: seg.thicknessGroup === 'outer', text: GROUP_LABEL.outer }),
  ]);
  const groupRow = el('div', { class: 'field' }, [
    el('span', { class: 'field-label', text: 'Groupe d’épaisseur' }),
    groupSelect,
    el('span', { class: 'hint', text: `${resolvedThickness}mm` }),
  ]);

  const heightInput = el('input', {
    type: 'number',
    step: '0.5',
    min: '0',
    value: seg.heightMm != null ? String(seg.heightMm) : '',
    placeholder: `hérite: ${resolvedHeight}mm`,
    onChange: (evt) => {
      const raw = evt.target.value.trim();
      const heightMm = raw === '' ? null : Number(raw);
      store.apply((p) => ({ ...p, grid: setSegmentHeight(p.grid, kind, c, r, heightMm) }));
    },
  });
  const heightRow = el('div', { class: 'field' }, [
    el('span', { class: 'field-label', text: 'Hauteur (mm)' }),
    heightInput,
    outer ? el('span', { class: 'hint', text: 'S’applique à tout le pourtour extérieur.' }) : null,
  ]);

  return el('div', { class: 'inspector' }, [
    el('h3', { text: `Mur ${KIND_LABEL[kind]} — c=${c}, r=${r}` }),
    presenceRow,
    groupRow,
    heightRow,
  ]);
}
