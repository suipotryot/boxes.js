// Project-wide defaults (grid dimensions, thickness/height groups, finger
// joint tuning) as opposed to SegmentInspector's per-segment overrides.
// Grid resize is the one field here that can destroy data (dropping an
// interior wall/floor customization that no longer fits), so it's the one
// field that asks first.
import { el } from './dom.js';
import { resizeGrid } from '../model/Grid.js';

function parseMmList(text) {
  return text.split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n > 0);
}

function numberField(labelText, value, onChange, step = '0.1') {
  return el('label', { class: 'field' }, [
    el('span', { class: 'field-label', text: labelText }),
    el('input', {
      type: 'number', step, min: '0', value: String(value),
      onChange: (evt) => {
        const n = Number(evt.target.value);
        if (Number.isFinite(n) && n > 0) onChange(n);
      },
    }),
  ]);
}

function gridSizeField(labelText, values, onResize) {
  return el('label', { class: 'field' }, [
    el('span', { class: 'field-label', text: labelText }),
    el('input', {
      type: 'text', value: values.join(', '),
      onChange: (evt) => {
        const parsed = parseMmList(evt.target.value);
        if (parsed.length > 0) onResize(parsed);
        evt.target.value = values.join(', '); // re-render (via store notify) supplies the real value; this just avoids a flash of stale text if the change is rejected
      },
    }),
  ]);
}

export function renderSettingsPanel(project, store) {
  const grid = project.grid;

  const applyResize = (axis, parsed) => {
    const newSx = axis === 'x' ? parsed : grid.sx;
    const newSy = axis === 'y' ? parsed : grid.sy;
    const { grid: resized, lostCustomization } = resizeGrid(grid, newSx, newSy);
    if (lostCustomization) {
      const ok = window.confirm('Ce redimensionnement va faire perdre des personnalisations de segments existants (hauteur, épaisseur ou suppression). Continuer ?');
      if (!ok) return;
    }
    store.apply((p) => ({ ...p, grid: resized }));
  };

  return el('div', { class: 'settings-panel' }, [
    el('h3', { text: 'Grille' }),
    gridSizeField('Colonnes (sx, mm)', grid.sx, (parsed) => applyResize('x', parsed)),
    gridSizeField('Rangées (sy, mm)', grid.sy, (parsed) => applyResize('y', parsed)),

    el('h3', { text: 'Épaisseurs & hauteurs' }),
    numberField('Épaisseur extérieure (mm)', project.outerThicknessMm, (n) => store.apply((p) => ({ ...p, outerThicknessMm: n }))),
    numberField('Épaisseur intérieure (mm)', project.innerThicknessMm, (n) => store.apply((p) => ({ ...p, innerThicknessMm: n }))),
    numberField('Hauteur extérieure (mm)', project.outerHeightMm, (n) => store.apply((p) => ({ ...p, outerHeightMm: n }))),
    numberField('Hauteur intérieure par défaut (mm)', project.innerHeightMm, (n) => store.apply((p) => ({ ...p, innerHeightMm: n }))),
    numberField('Jeu de coupe / burn (mm)', project.burnMm, (n) => store.apply((p) => ({ ...p, burnMm: n })), '0.01'),

    el('h3', { text: 'Doigts (finger joint)' }),
    numberField('Largeur doigt (mm)', project.fingerJoint.fingerMm, (n) => store.apply((p) => ({ ...p, fingerJoint: { ...p.fingerJoint, fingerMm: n } }))),
    numberField('Largeur espace (mm)', project.fingerJoint.spaceMm, (n) => store.apply((p) => ({ ...p, fingerJoint: { ...p.fingerJoint, spaceMm: n } }))),
    numberField('Marge (mm)', project.fingerJoint.marginMm, (n) => store.apply((p) => ({ ...p, fingerJoint: { ...p.fingerJoint, marginMm: n } }))),
    numberField('Jeu (play, mm)', project.fingerJoint.playMm, (n) => store.apply((p) => ({ ...p, fingerJoint: { ...p.fingerJoint, playMm: n } })), '0.01'),
  ]);
}
