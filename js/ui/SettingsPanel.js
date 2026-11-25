// Project-wide defaults (grid dimensions, thickness/height groups, finger
// joint tuning) as opposed to SegmentInspector's per-segment overrides.
// Grid resize is the one field here that can destroy data (dropping an
// interior wall/floor customization that no longer fits), so it's the one
// field that asks first.
import { el } from './dom.js';
import { numberField, textField, infoIcon } from './fields.js';
import { FINGER_MM_HELP, SPACE_MM_HELP, MARGIN_MM_HELP, PLAY_MM_HELP, BURN_MM_HELP, LASER_WIDTH_HELP, LASER_HEIGHT_HELP, LASER_SPACING_HELP, DRAWER_PLAY_HELP, DRAWER_THICKNESS_HELP } from './fieldHelp.js';
import { resizeGrid } from '../model/Grid.js';
import { validateLid, basePlateMode, basePlateRecessMm, isBasePlateRecessValid, lidCoverage, validateCoverage, interiorExtentAcross } from '../model/GridQuery.js';
import { coverageHoldsFlankTabs } from '../geometry/oo/Assembly.js';
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

function sideLabels() {
  return { top: t('settingsPanel.sideTop'), bottom: t('settingsPanel.sideBottom'), right: t('settingsPanel.sideRight'), left: t('settingsPanel.sideLeft') };
}

function sideRadioField({ label, help, name, checkedSide, onPick }) {
  return el('div', { class: 'field' }, [
    el('span', { class: 'field-label' }, [label, infoIcon(help)]),
    el('div', { class: 'radio-group' }, Object.entries(sideLabels()).map(([value, sideLabel]) => el('label', { class: 'radio-option' }, [
      el('input', {
        type: 'radio', name, value, checked: checkedSide === value,
        onChange: () => onPick(value),
      }),
      el('span', { text: ` ${sideLabel}` }),
    ]))),
  ]);
}

const DEFAULT_COVERAGE_SHARE = 1 / 3;

function defaultCoverage(project, side) {
  return { side, depthMm: Math.round(interiorExtentAcross(project.grid, project, side) * DEFAULT_COVERAGE_SHARE) };
}

function partialCoverageToggle(project, coverage, setCoverage) {
  return el('label', { class: 'field lid-enabled' }, [
    el('input', {
      type: 'checkbox', checked: !!coverage,
      onChange: (evt) => setCoverage(evt.target.checked ? defaultCoverage(project, 'top') : null),
    }),
    el('span', { text: ` ${t('settingsPanel.lidCoverage')}` }),
    infoIcon(t('settingsPanel.lidCoverageHelp')),
  ]);
}

function coverageSideField(coverage, setCoverage) {
  return sideRadioField({
    label: t('settingsPanel.lidCoverageSide'),
    help: t('settingsPanel.lidCoverageSideHelp'),
    name: 'lid-coverage-side',
    checkedSide: coverage.side,
    onPick: (side) => setCoverage({ ...coverage, side }),
  });
}

function coverageDepthField(coverage, setCoverage) {
  return numberField(t('settingsPanel.lidCoverageDepth'), coverage.depthMm, (depthMm) => setCoverage({ ...coverage, depthMm }), '1', t('settingsPanel.lidCoverageDepthHelp'));
}

function coverageFeedback(project, coverage, setCoverage) {
  const validation = validateCoverage(project.grid, project, coverage);
  if (!validation.ok) {
    return el('div', { class: 'field' }, [
      el('span', { class: 'warning', text: t('settingsPanel.lidCoverageInvalid', { max: validation.max }) }),
      el('button', { class: 'btn', text: t('shared.autoFix'), onClick: () => setCoverage(defaultCoverage(project, coverage.side)) }),
    ]);
  }
  if (!coverageHoldsFlankTabs(project.grid, project, coverage)) {
    return el('div', { class: 'field' }, [el('span', { class: 'hint', text: t('settingsPanel.lidCoverageNoFlankTabs') })]);
  }
  return null;
}

function coverageFields(project, store) {
  const coverage = lidCoverage(project);
  const setCoverage = (next) => store.apply((p) => ({ ...p, lid: { ...p.lid, coverage: next } }));
  const toggle = partialCoverageToggle(project, coverage, setCoverage);
  if (!coverage) return [toggle];
  return [
    toggle,
    coverageSideField(coverage, setCoverage),
    coverageDepthField(coverage, setCoverage),
    coverageFeedback(project, coverage, setCoverage),
  ];
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

  return collapsibleSection(openSections, onToggleSection, 'lid', t('settingsPanel.lidSection'), [enabledRow, modeField, heightField, warning, ...coverageFields(project, store)]);
}

function basePlateModeLabels() {
  return { flush: t('settingsPanel.basePlateModeFlush'), recessed: t('settingsPanel.basePlateModeRecessed') };
}

function basePlateSection(project, store, openSections, onToggleSection) {
  const mode = basePlateMode(project);
  const setBasePlate = (changes) => store.apply((p) => ({ ...p, basePlate: { ...p.basePlate, ...changes } }));

  const modeField = el('div', { class: 'field' }, [
    el('span', { class: 'field-label' }, [t('settingsPanel.basePlateMode'), infoIcon(t('settingsPanel.basePlateModeHelp'))]),
    el('div', { class: 'radio-group' }, Object.entries(basePlateModeLabels()).map(([value, label]) => el('label', { class: 'radio-option' }, [
      el('input', {
        type: 'radio', name: 'base-plate-mode', value, checked: mode === value,
        onChange: () => setBasePlate({ mode: value }),
      }),
      el('span', { text: ` ${label}` }),
    ]))),
  ]);

  if (mode === 'flush') {
    return collapsibleSection(openSections, onToggleSection, 'basePlate', t('settingsPanel.basePlateSection'), [modeField]);
  }

  const recessMm = basePlateRecessMm(project);
  const recessField = numberField(t('settingsPanel.basePlateRecess'), recessMm, (n) => setBasePlate({ recessMm: n }), '1', t('settingsPanel.basePlateRecessHelp'));
  const warning = !isBasePlateRecessValid(recessMm) ? el('div', { class: 'field' }, [
    el('span', { class: 'warning', text: t('settingsPanel.basePlateRecessInvalid') }),
    el('button', { class: 'btn', text: t('shared.autoFix'), onClick: () => setBasePlate({ recessMm: null }) }),
  ]) : null;

  return collapsibleSection(openSections, onToggleSection, 'basePlate', t('settingsPanel.basePlateSection'), [modeField, recessField, warning]);
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

  const sideField = sideRadioField({
    label: t('settingsPanel.drawerOpenSide'),
    help: t('settingsPanel.drawerOpenSideHelp'),
    name: 'drawer-open-side',
    checkedSide: drawer.openSide,
    onPick: (openSide) => store.apply((p) => ({ ...p, drawer: { ...p.drawer, openSide } })),
  });

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

    basePlateSection(project, store, openSections, onToggleSection),
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
