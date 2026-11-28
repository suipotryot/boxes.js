// Project-wide defaults (grid dimensions, thickness/height groups, finger
// joint tuning) as opposed to SegmentInspector's per-segment overrides.
// Grid resize is the one field here that can destroy data (dropping an
// interior wall/floor customization that no longer fits), so it's the one
// field that asks first.
import { el } from './dom.js';
import { collapsibleSection } from './CollapsibleSection.js';
import { numberField, textField, infoIcon, trashIcon } from './fields.js';
import { FINGER_MM_HELP, SPACE_MM_HELP, MARGIN_MM_HELP, PLAY_MM_HELP, BURN_MM_HELP, LASER_WIDTH_HELP, LASER_HEIGHT_HELP, LASER_SPACING_HELP, DRAWER_PLAY_HELP, DRAWER_THICKNESS_HELP } from './fieldHelp.js';
import { resizeGrid } from '../model/Grid.js';
import { validateHorizontalPanelHeight, basePlateMode, basePlateRecessMm, isBasePlateRecessValid, horizontalPanelCoverage, validateCoverage, interiorExtentAcross } from '../model/GridQuery.js';
import { addHorizontalPanel, removeHorizontalPanel, updateHorizontalPanel, horizontalPanelNumber, heightBroughtIntoRange } from '../model/HorizontalPanels.js';
import { coverageHoldsFlankTabs } from '../geometry/oo/Assembly.js';
import { t } from '../i18n/index.js';
import { copySlotCountOf } from '../export/CopyPieces.js';
import { parseCopyUrls } from '../image/CopyUrlList.js';

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
    el('span', { text: ` ${t('settingsPanel.horizontalPanelCoverage')}` }),
    infoIcon(t('settingsPanel.horizontalPanelCoverageHelp')),
  ]);
}

function coverageSideField(panelId, coverage, setCoverage) {
  return sideRadioField({
    label: t('settingsPanel.horizontalPanelCoverageSide'),
    help: t('settingsPanel.horizontalPanelCoverageSideHelp'),
    name: `${panelId}-coverage-side`,
    checkedSide: coverage.side,
    onPick: (side) => setCoverage({ ...coverage, side }),
  });
}

function coverageDepthField(coverage, setCoverage) {
  return numberField(t('settingsPanel.horizontalPanelCoverageDepth'), coverage.depthMm, (depthMm) => setCoverage({ ...coverage, depthMm }), '1', t('settingsPanel.horizontalPanelCoverageDepthHelp'));
}

function coverageFeedback(project, coverage, setCoverage) {
  const validation = validateCoverage(project.grid, project, coverage);
  if (!validation.ok) {
    return el('div', { class: 'field' }, [
      el('span', { class: 'warning', text: t('settingsPanel.horizontalPanelCoverageInvalid', { max: validation.max }) }),
      el('button', { class: 'btn', text: t('shared.autoFix'), onClick: () => setCoverage(defaultCoverage(project, coverage.side)) }),
    ]);
  }
  if (!coverageHoldsFlankTabs(project.grid, project, coverage)) {
    return el('div', { class: 'field' }, [el('span', { class: 'hint', text: t('settingsPanel.horizontalPanelCoverageNoFlankTabs') })]);
  }
  return null;
}

function coverageFields(project, panel, updatePanel) {
  const coverage = horizontalPanelCoverage(panel);
  const setCoverage = (next) => updatePanel({ coverage: next });
  const toggle = partialCoverageToggle(project, coverage, setCoverage);
  if (!coverage) return [toggle];
  return [
    toggle,
    coverageSideField(panel.id, coverage, setCoverage),
    coverageDepthField(coverage, setCoverage),
    coverageFeedback(project, coverage, setCoverage),
  ];
}

function horizontalPanelHeader(panel, removePanel) {
  const deleteLabel = t('settingsPanel.horizontalPanelDelete');
  return el('div', { class: 'compact-item-row' }, [
    el('span', { class: 'field-label', text: t('settingsPanel.horizontalPanelTitle', { number: horizontalPanelNumber(panel) }) }),
    el('button', {
      class: 'icon-btn', title: deleteLabel, 'aria-label': deleteLabel,
      onClick: removePanel,
    }, [trashIcon()]),
  ]);
}

function optionalMmFrom(text) {
  const trimmed = text.trim();
  return trimmed === '' ? null : Number(trimmed);
}

function horizontalPanelHeightField(panel, validation, updatePanel) {
  return el('label', { class: 'field' }, [
    el('span', { class: 'field-label' }, [t('settingsPanel.horizontalPanelHeight'), infoIcon(t('settingsPanel.horizontalPanelHeightHelp'))]),
    el('input', {
      type: 'number', step: '1', min: '0',
      value: panel.heightMm != null ? String(panel.heightMm) : '',
      onChange: (evt) => updatePanel({ heightMm: optionalMmFrom(evt.target.value) }),
    }),
    el('span', { class: 'hint', text: t('settingsPanel.horizontalPanelValidRange', { min: validation.min, max: validation.max }) }),
  ]);
}

function horizontalPanelHeightWarning(panel, validation, updatePanel) {
  if (validation.ok) return null;
  return el('div', { class: 'field' }, [
    el('span', { class: 'warning', text: t('settingsPanel.horizontalPanelInvalid', { min: validation.min, max: validation.max }) }),
    el('button', {
      class: 'btn', text: t('shared.autoFix'),
      onClick: () => updatePanel({ heightMm: heightBroughtIntoRange(panel.heightMm, validation) }),
    }),
  ]);
}

function horizontalPanelFields(project, panel, store) {
  const updatePanel = (changes) => store.apply((p) => updateHorizontalPanel(p, panel.id, changes));
  const removePanel = () => store.apply((p) => removeHorizontalPanel(p, panel.id));
  const validation = validateHorizontalPanelHeight(project.grid, project, panel.heightMm);
  return el('div', { class: 'horizontal-panel' }, [
    horizontalPanelHeader(panel, removePanel),
    horizontalPanelHeightField(panel, validation, updatePanel),
    horizontalPanelHeightWarning(panel, validation, updatePanel),
    ...coverageFields(project, panel, updatePanel),
  ]);
}

function horizontalPanelsSection(project, store, openSections, onToggleSection) {
  const intro = el('p', { class: 'hint', text: t('settingsPanel.horizontalPanelsHelp') });
  const addButton = el('button', { class: 'btn', text: t('settingsPanel.horizontalPanelAdd'), onClick: () => store.apply(addHorizontalPanel) });
  const panels = project.horizontalPanels.map((panel) => horizontalPanelFields(project, panel, store));
  return collapsibleSection(openSections, onToggleSection, 'horizontalPanels', t('settingsPanel.horizontalPanelsSection'), [intro, ...panels, addButton]);
}

function lidSection(project, store, openSections, onToggleSection) {
  const enabledRow = el('label', { class: 'field lid-enabled' }, [
    el('input', {
      type: 'checkbox', checked: project.lid.enabled,
      onChange: (evt) => store.apply((p) => ({ ...p, lid: { ...p.lid, enabled: evt.target.checked } })),
    }),
    el('span', { text: ` ${t('settingsPanel.lidEnabled')}` }),
    infoIcon(t('settingsPanel.lidHelp')),
  ]);
  return collapsibleSection(openSections, onToggleSection, 'lid', t('settingsPanel.lidSection'), [enabledRow]);
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

function copiesSummary(project) {
  const slotCount = copySlotCountOf(project);
  try {
    const copyCount = parseCopyUrls(project.copyImageUrls, slotCount).length;
    return { text: t('settingsPanel.copiesSummary', { slots: slotCount, copies: copyCount }), isValid: true };
  } catch (error) {
    return { text: t('settingsPanel.copiesInvalid', { reason: error.message }), isValid: false };
  }
}

function copiesSection(project, store, openSections, onToggleSection) {
  const summary = copiesSummary(project);
  const urlsField = el('textarea', {
    rows: '6', placeholder: t('settingsPanel.copiesPlaceholder'), value: project.copyImageUrls,
    onChange: (evt) => store.apply((p) => ({ ...p, copyImageUrls: evt.target.value })),
  });
  return collapsibleSection(openSections, onToggleSection, 'copies', t('settingsPanel.copiesSection'), [
    el('div', { class: 'field-label' }, [t('settingsPanel.copiesUrls'), infoIcon(t('settingsPanel.copiesHelp'))]),
    el('div', { class: 'field' }, [urlsField]),
    el('div', { class: summary.isValid ? 'hint' : 'warning', text: summary.text }),
  ]);
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
    horizontalPanelsSection(project, store, openSections, onToggleSection),
    lidSection(project, store, openSections, onToggleSection),
    drawerSection(project, store, openSections, onToggleSection),
    copiesSection(project, store, openSections, onToggleSection),

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
