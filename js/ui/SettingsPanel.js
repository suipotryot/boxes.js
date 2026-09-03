// Project-wide defaults (grid dimensions, thickness/height groups, finger
// joint tuning) as opposed to SegmentInspector's per-segment overrides.
// Grid resize is the one field here that can destroy data (dropping an
// interior wall/floor customization that no longer fits), so it's the one
// field that asks first.
import { el } from './dom.js';
import { numberField, textField, infoIcon } from './fields.js';
import { FINGER_MM_HELP, SPACE_MM_HELP, MARGIN_MM_HELP, PLAY_MM_HELP, BURN_MM_HELP, LASER_WIDTH_HELP, LASER_HEIGHT_HELP, LASER_SPACING_HELP, DRAWER_PLAY_HELP, DRAWER_THICKNESS_HELP } from './fieldHelp.js';
import { resizeGrid } from '../model/Grid.js';
import { validateLid } from '../model/GridQuery.js';
import { t } from '../i18n/index.js';

function parseMmList(text) {
  return text.split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n > 0);
}

function gridSizeField(labelText, values, onResize, tooltip) {
  return el('label', { class: 'field' }, [
    el('span', { class: 'field-label' }, [labelText, infoIcon(tooltip)]),
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

// A collapsible section, open/closed state owned by EditorView.js
// (openSections/onToggleSection — same idiom as `selected`/`showLabels`)
// so it survives this panel's own frequent full rebuilds. `key` indexes
// into `openSections`; onToggleSection deliberately does NOT trigger a
// re-render on its own (see EditorView.js's own comment on that) — the
// native <details> already handles its expand/collapse visually, and
// re-rendering an already-open one from scratch on every toggle is what
// caused a real infinite loop (rebuilding + re-attaching an open
// <details> fires its own 'toggle' event again in Chromium).
function collapsibleSection(openSections, onToggleSection, key, title, children) {
  return el('details', {
    open: openSections[key],
    ontoggle: (evt) => onToggleSection(key, evt.target.open),
  }, [el('summary', { text: title }), ...children]);
}

function lidModeLabels() {
  return { recessed: t('settingsPanel.lidModeRecessed'), onTop: t('settingsPanel.lidModeOnTop') };
}

// Fixed lid only (see the plan's 2026-08-20 scope cut — no floating
// variant): a checkbox, a mode choice, and — only in 'recessed' mode — its
// insertion height, with the pure GridQuery.validateLid() check surfaced
// directly rather than silently clamped — an out-of-range height shows
// why, and offers a one-click fix instead of correcting it behind the
// user's back. 'onTop' shows no height field at all: its own insertion
// height is always implicit (the walls' own nominal top), never a value
// to pick — offering a number there would invite exactly the kind of
// "one forbidden value in the middle of a range" confusion this mode
// split was introduced to avoid (see the plan's own account of the
// now-retired "flush" special case).
function lidSection(project, store, openSections, onToggleSection) {
  const { lid, grid } = project;
  const mode = lid.mode ?? 'recessed';

  const enabledRow = el('label', { class: 'field lid-enabled' }, [
    el('input', {
      type: 'checkbox', checked: lid.enabled,
      onChange: (evt) => store.apply((p) => ({ ...p, lid: { ...p.lid, enabled: evt.target.checked } })),
    }),
    el('span', { text: ` ${t('settingsPanel.lidEnabled')}` }),
    infoIcon(t('settingsPanel.lidHelp')),
  ]);

  if (!lid.enabled) {
    return collapsibleSection(openSections, onToggleSection, 'lid', t('settingsPanel.lidSection'), [enabledRow]);
  }

  const modeField = el('div', { class: 'field' }, [
    el('span', { class: 'field-label' }, [t('settingsPanel.lidMode'), infoIcon(t('settingsPanel.lidModeHelp'))]),
    el('div', { class: 'radio-group' }, Object.entries(lidModeLabels()).map(([value, label]) => el('label', { class: 'radio-option' }, [
      el('input', {
        type: 'radio', name: 'lid-mode', value, checked: mode === value,
        onChange: () => store.apply((p) => ({ ...p, lid: { ...p.lid, mode: value } })),
      }),
      el('span', { text: ` ${label}` }),
    ]))),
  ]);

  if (mode === 'onTop') {
    return collapsibleSection(openSections, onToggleSection, 'lid', t('settingsPanel.lidSection'), [enabledRow, modeField]);
  }

  const validation = validateLid(grid, project, lid.insertHeightMm);

  const heightField = el('label', { class: 'field' }, [
    el('span', { class: 'field-label' }, [t('settingsPanel.lidInsertHeight'), infoIcon(t('settingsPanel.lidInsertHeightHelp'))]),
    el('input', {
      type: 'number', step: '1', min: '0',
      value: lid.insertHeightMm != null ? String(lid.insertHeightMm) : '',
      onChange: (evt) => {
        const raw = evt.target.value.trim();
        const insertHeightMm = raw === '' ? null : Number(raw);
        store.apply((p) => ({ ...p, lid: { ...p.lid, insertHeightMm } }));
      },
    }),
    el('span', { class: 'hint', text: t('settingsPanel.lidValidRange', { min: validation.min, max: validation.max }) }),
  ]);

  const warning = !validation.ok ? el('div', { class: 'field' }, [
    el('span', { class: 'warning', text: t('settingsPanel.lidInvalid', { min: validation.min, max: validation.max }) }),
    el('button', {
      class: 'btn', text: t('shared.autoFix'),
      onClick: () => {
        const clamped = lid.insertHeightMm == null
          ? validation.max
          : Math.min(Math.max(lid.insertHeightMm, validation.min), validation.max);
        store.apply((p) => ({ ...p, lid: { ...p.lid, insertHeightMm: clamped } }));
      },
    }),
  ]) : null;

  return collapsibleSection(openSections, onToggleSection, 'lid', t('settingsPanel.lidSection'), [enabledRow, modeField, heightField, warning]);
}

// The "Étiqueter les pièces" toggle — controls both the live preview
// strip's labels and the SVG export's labels (EditorView-owned
// showLabels/onToggleLabels, same idiom as openSections/selected). Lives
// here rather than next to the export button so it isn't lost among the
// low-frequency settings, yet doesn't clutter the toolbar either.
function optionsSection(openSections, onToggleSection, showLabels, onToggleLabels) {
  const labelsRow = el('label', { class: 'field lid-enabled' }, [
    el('input', {
      type: 'checkbox', checked: showLabels,
      onChange: (evt) => onToggleLabels(evt.target.checked),
    }),
    el('span', { text: ` ${t('settingsPanel.labelPieces')}` }),
    infoIcon(t('settingsPanel.labelPiecesHelp')),
  ]);
  return collapsibleSection(openSections, onToggleSection, 'options', t('settingsPanel.optionsSection'), [labelsRow]);
}

function openSideLabels() {
  return { top: t('settingsPanel.sideTop'), bottom: t('settingsPanel.sideBottom'), right: t('settingsPanel.sideRight'), left: t('settingsPanel.sideLeft') };
}

// The "boîte en tiroir" feature: an independent enclosing sleeve box (own
// grid, own thickness, see DrawerBuilder.js) built around the current
// box's own outer footprint, open on one side. Always 5 pieces (base +
// lid + 3 walls) regardless of which side is open — see DrawerBuilder.js's
// own header comment for why base/lid are never the open side.
function drawerSection(project, store, openSections, onToggleSection) {
  const { drawer } = project;

  const enabledRow = el('label', { class: 'field lid-enabled' }, [
    el('input', {
      type: 'checkbox', checked: drawer.enabled,
      onChange: (evt) => store.apply((p) => ({ ...p, drawer: { ...p.drawer, enabled: evt.target.checked } })),
    }),
    el('span', { text: ` ${t('settingsPanel.drawerSection')}` }),
    infoIcon(t('settingsPanel.drawerHelp')),
  ]);

  if (!drawer.enabled) {
    return collapsibleSection(openSections, onToggleSection, 'drawer', t('settingsPanel.drawerSection'), [enabledRow]);
  }

  const sideField = el('div', { class: 'field' }, [
    el('span', { class: 'field-label' }, [t('settingsPanel.drawerOpenSide'), infoIcon(t('settingsPanel.drawerOpenSideHelp'))]),
    el('div', { class: 'radio-group' }, Object.entries(openSideLabels()).map(([value, label]) => el('label', { class: 'radio-option' }, [
      el('input', {
        type: 'radio', name: 'drawer-open-side', value, checked: drawer.openSide === value,
        onChange: () => store.apply((p) => ({ ...p, drawer: { ...p.drawer, openSide: value } })),
      }),
      el('span', { text: ` ${label}` }),
    ]))),
  ]);

  return collapsibleSection(openSections, onToggleSection, 'drawer', t('settingsPanel.drawerSection'), [
    enabledRow,
    numberField(t('field.drawerPlay'), drawer.playMm, (n) => store.apply((p) => ({ ...p, drawer: { ...p.drawer, playMm: n } })), '0.1', DRAWER_PLAY_HELP()),
    numberField(t('field.drawerThickness'), drawer.thicknessMm, (n) => store.apply((p) => ({ ...p, drawer: { ...p.drawer, thicknessMm: n } })), '1', DRAWER_THICKNESS_HELP()),
    sideField,
  ]);
}

export function renderSettingsPanel(project, store, openSections, onToggleSection, showLabels, onToggleLabels) {
  const grid = project.grid;

  const applyResize = (axis, parsed) => {
    const newSx = axis === 'x' ? parsed : grid.sx;
    const newSy = axis === 'y' ? parsed : grid.sy;
    const { grid: resized, lostCustomization } = resizeGrid(grid, newSx, newSy);
    if (lostCustomization) {
      const ok = window.confirm(t('settingsPanel.resizeConfirm'));
      if (!ok) return;
    }
    store.apply((p) => ({ ...p, grid: resized }));
  };

  return el('div', { class: 'settings-panel' }, [
    el('h3', { text: t('settingsPanel.projectSection') }),
    textField(t('settingsPanel.projectName'), project.name, (name) => store.apply((p) => ({ ...p, name })), t('settingsPanel.projectNameHelp')),

    el('h3', { text: t('settingsPanel.gridSection') }),
    gridSizeField(t('settingsPanel.columns'), grid.sx, (parsed) => applyResize('x', parsed), t('settingsPanel.columnsHelp')),
    gridSizeField(t('settingsPanel.rows'), grid.sy, (parsed) => applyResize('y', parsed), t('settingsPanel.rowsHelp')),

    collapsibleSection(openSections, onToggleSection, 'thickness', t('settingsPanel.thicknessSection'), [
      numberField(t('settingsPanel.outerThickness'), project.outerThicknessMm, (n) => store.apply((p) => ({ ...p, outerThicknessMm: n })), '1', t('settingsPanel.outerThicknessHelp')),
      numberField(t('settingsPanel.innerThickness'), project.innerThicknessMm, (n) => store.apply((p) => ({ ...p, innerThicknessMm: n })), '1', t('settingsPanel.innerThicknessHelp')),
      numberField(t('settingsPanel.outerHeight'), project.outerHeightMm, (n) => store.apply((p) => ({ ...p, outerHeightMm: n })), '1', t('settingsPanel.outerHeightHelp')),
      numberField(t('settingsPanel.innerHeight'), project.innerHeightMm, (n) => store.apply((p) => ({ ...p, innerHeightMm: n })), '1', t('settingsPanel.innerHeightHelp')),
      numberField(t('field.burnMm'), project.burnMm, (n) => store.apply((p) => ({ ...p, burnMm: n })), '0.01', BURN_MM_HELP()),
    ]),

    optionsSection(openSections, onToggleSection, showLabels, onToggleLabels),

    lidSection(project, store, openSections, onToggleSection),
    drawerSection(project, store, openSections, onToggleSection),

    collapsibleSection(openSections, onToggleSection, 'fingerJoint', t('shared.fingerJointSection'), [
      numberField(t('field.fingerMm'), project.fingerJoint.fingerMm, (n) => store.apply((p) => ({ ...p, fingerJoint: { ...p.fingerJoint, fingerMm: n } })), '1', FINGER_MM_HELP()),
      numberField(t('field.spaceMm'), project.fingerJoint.spaceMm, (n) => store.apply((p) => ({ ...p, fingerJoint: { ...p.fingerJoint, spaceMm: n } })), '1', SPACE_MM_HELP()),
      numberField(t('field.marginMm'), project.fingerJoint.marginMm, (n) => store.apply((p) => ({ ...p, fingerJoint: { ...p.fingerJoint, marginMm: n } })), '1', MARGIN_MM_HELP()),
      numberField(t('field.playMm'), project.fingerJoint.playMm, (n) => store.apply((p) => ({ ...p, fingerJoint: { ...p.fingerJoint, playMm: n } })), '0.01', PLAY_MM_HELP()),
    ]),

    collapsibleSection(openSections, onToggleSection, 'laserBed', t('shared.laserSection'), [
      numberField(t('field.laserWidth'), project.laserBed.widthMm, (n) => store.apply((p) => ({ ...p, laserBed: { ...p.laserBed, widthMm: n } })), '1', LASER_WIDTH_HELP()),
      numberField(t('field.laserHeight'), project.laserBed.heightMm, (n) => store.apply((p) => ({ ...p, laserBed: { ...p.laserBed, heightMm: n } })), '1', LASER_HEIGHT_HELP()),
      numberField(t('field.laserSpacing'), project.laserBed.spacingMm, (n) => store.apply((p) => ({ ...p, laserBed: { ...p.laserBed, spacingMm: n } })), '1', LASER_SPACING_HELP()),
    ]),
  ]);
}
