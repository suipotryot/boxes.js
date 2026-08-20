// Project-wide defaults (grid dimensions, thickness/height groups, finger
// joint tuning) as opposed to SegmentInspector's per-segment overrides.
// Grid resize is the one field here that can destroy data (dropping an
// interior wall/floor customization that no longer fits), so it's the one
// field that asks first.
import { el } from './dom.js';
import { numberField, textField } from './fields.js';
import { resizeGrid } from '../model/Grid.js';
import { validateLid } from '../model/GridQuery.js';

function parseMmList(text) {
  return text.split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n > 0);
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

// Fixed lid only (see the plan's 2026-08-20 scope cut — no floating
// variant): a checkbox plus its insertion height, with the pure
// GridQuery.validateLid() check surfaced directly rather than silently
// clamped — an out-of-range height shows why, and offers a one-click fix
// instead of correcting it behind the user's back.
function lidSection(project, store) {
  const { lid, grid } = project;

  const enabledRow = el('label', { class: 'field lid-enabled' }, [
    el('input', {
      type: 'checkbox', checked: lid.enabled,
      onChange: (evt) => store.apply((p) => ({ ...p, lid: { ...p.lid, enabled: evt.target.checked } })),
    }),
    el('span', { text: ' Couvercle fixe' }),
  ]);

  if (!lid.enabled) {
    return el('div', {}, [el('h3', { text: 'Couvercle' }), enabledRow]);
  }

  const validation = validateLid(grid, project, lid.insertHeightMm);

  const heightField = el('label', { class: 'field' }, [
    el('span', { class: 'field-label', text: 'Hauteur d’insertion (mm)' }),
    el('input', {
      type: 'number', step: '1', min: '0',
      value: lid.insertHeightMm != null ? String(lid.insertHeightMm) : '',
      onChange: (evt) => {
        const raw = evt.target.value.trim();
        const insertHeightMm = raw === '' ? null : Number(raw);
        store.apply((p) => ({ ...p, lid: { ...p.lid, insertHeightMm } }));
      },
    }),
    el('span', { class: 'hint', text: `Plage valide : ${validation.min}–${validation.max}mm (au-dessus de toute cloison interne, jusqu’au sommet du périmètre).` }),
  ]);

  const warning = !validation.ok ? el('div', { class: 'field' }, [
    el('span', { class: 'warning', text: `Hauteur invalide — doit être entre ${validation.min} et ${validation.max}mm.` }),
    el('button', {
      class: 'btn', text: 'Ajuster automatiquement',
      onClick: () => {
        const clamped = lid.insertHeightMm == null
          ? validation.max
          : Math.min(Math.max(lid.insertHeightMm, validation.min), validation.max);
        store.apply((p) => ({ ...p, lid: { ...p.lid, insertHeightMm: clamped } }));
      },
    }),
  ]) : null;

  return el('div', {}, [el('h3', { text: 'Couvercle' }), enabledRow, heightField, warning]);
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
    el('h3', { text: 'Projet' }),
    textField('Nom du projet', project.name, (name) => store.apply((p) => ({ ...p, name }))),

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
    numberField('Marge min. (mm)', project.fingerJoint.marginMm, (n) => store.apply((p) => ({ ...p, fingerJoint: { ...p.fingerJoint, marginMm: n } }))),
    numberField('Jeu (play, mm)', project.fingerJoint.playMm, (n) => store.apply((p) => ({ ...p, fingerJoint: { ...p.fingerJoint, playMm: n } })), '0.01'),

    lidSection(project, store),

    el('h3', { text: 'Découpe laser' }),
    numberField('Largeur de la zone de travail (mm)', project.laserBed.widthMm, (n) => store.apply((p) => ({ ...p, laserBed: { ...p.laserBed, widthMm: n } }))),
    numberField('Hauteur de la zone de travail (mm)', project.laserBed.heightMm, (n) => store.apply((p) => ({ ...p, laserBed: { ...p.laserBed, heightMm: n } }))),
    numberField('Espacement entre pièces (mm)', project.laserBed.spacingMm, (n) => store.apply((p) => ({ ...p, laserBed: { ...p.laserBed, spacingMm: n } }))),
  ]);
}
