// Hosts two independent sections in the same sidebar panel: the grid
// SEGMENT fields (present/height/thickness — a click on the editor grid
// selects a segment, see EditorView, but never mutates it directly, so
// "select" and "toggle" are never the same ambiguous click), and the grip-
// notch editor (GripNotchEditor.js) for whichever WALL PIECE is selected.
// These two selections are independent (EditorView.js's `selected` vs
// `selectedWallId`) because a drawer sleeve's own walls have no grid
// segment to click at all — the only way to reach one is a preview-strip
// card click, which sets `selectedWallId` alone.
import { el } from './dom.js';
import { toggleWall, setSegmentHeight, isOuterSegment } from '../model/Grid.js';
import { resolveHeight, resolveThickness } from '../model/GridQuery.js';
import { resolveWallRunContext, resolvePieceHoleContext } from '../geometry/PieceContext.js';
import { renderGripNotchSection } from './GripNotchEditor.js';
import { renderHoleSection } from './HoleEditor.js';

const KIND_LABEL = { v: 'vertical', h: 'horizontal' };

function renderSegmentFields(project, selected, store) {
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

  // No group selector — a segment's thicknessGroup is fixed by its
  // position (outer perimeter vs. interior divider), never reassignable
  // per segment. Just show the resolved value, read-only.
  const groupRow = el('div', { class: 'field' }, [
    el('span', { class: 'field-label', text: 'Épaisseur' }),
    el('span', { class: 'hint', text: `${resolvedThickness}mm (${outer ? 'extérieur' : 'intérieur'})` }),
  ]);

  const heightInput = el('input', {
    type: 'number',
    step: '1',
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

  return el('div', { class: 'inspector-section' }, [
    el('h3', { text: `Mur ${KIND_LABEL[kind]} — c=${c}, r=${r}` }),
    presenceRow,
    groupRow,
    heightRow,
  ]);
}

export function renderInspector(project, selected, selectedWallId, store) {
  const sections = [];
  if (selected) sections.push(renderSegmentFields(project, selected, store));

  const wallContext = selectedWallId ? resolveWallRunContext(project, selectedWallId) : null;
  if (wallContext) sections.push(renderGripNotchSection(project, selectedWallId, wallContext, store));

  const holeContext = selectedWallId ? resolvePieceHoleContext(project, selectedWallId) : null;
  if (holeContext) sections.push(renderHoleSection(project, selectedWallId, holeContext, store));

  if (!sections.length) {
    return el('div', { class: 'inspector empty' }, [
      el('p', { text: 'Cliquez sur un segment de la grille, ou sur une pièce dans l’aperçu, pour l’inspecter.' }),
    ]);
  }

  return el('div', { class: 'inspector' }, sections);
}
