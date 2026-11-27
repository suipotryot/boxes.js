import { test, assert, run } from './testHarness.js';
import { createDefaultProject } from '../state/Project.js';
import { migrateLegacyLid } from '../state/ProjectMigration.js';

function legacyProject(lid) {
  return { ...createDefaultProject(), lid, horizontalPanels: [] };
}

const RECESSED_LID = { enabled: true, mode: 'recessed', insertHeightMm: 20, coverage: null };

test('migrateLegacyLid() should turn an enabled recessed lid into a horizontal panel at the same height, with the same coverage', () => {
  const coverage = { side: 'top', depthMm: 12 };
  const migrated = migrateLegacyLid(legacyProject({ ...RECESSED_LID, coverage }));
  assert(JSON.stringify(migrated.horizontalPanels) === JSON.stringify([{ id: 'horizontal-panel-1', heightMm: 20, coverage }]), `got ${JSON.stringify(migrated.horizontalPanels)}`);
  assert(JSON.stringify(migrated.lid) === JSON.stringify({ enabled: false }), `got ${JSON.stringify(migrated.lid)}`);
});

test('migrateLegacyLid() should move the lid holes to the new panel, leaving the drawer sleeve lid holes alone', () => {
  const lidHoles = [{ xMm: 10, yMm: 10, widthMm: 5, heightMm: 5, radiusMm: 0 }];
  const sleeveLidHoles = [{ xMm: 20, yMm: 20, widthMm: 5, heightMm: 5, radiusMm: 0 }];
  const project = { ...legacyProject(RECESSED_LID), pieceHoles: { lid: lidHoles, 'drawer:lid': sleeveLidHoles } };
  const migrated = migrateLegacyLid(project);
  assert(JSON.stringify(migrated.pieceHoles) === JSON.stringify({ 'horizontal-panel-1': lidHoles, 'drawer:lid': sleeveLidHoles }), `got ${JSON.stringify(migrated.pieceHoles)}`);
});

test('migrateLegacyLid() should move the lid edge notches to the new panel, leaving the drawer sleeve lid notches alone', () => {
  const notch = [{ widthMm: 10, depthMm: 5, offsetMm: 5, radiusMm: 0 }];
  const project = { ...legacyProject(RECESSED_LID), pieceNotches: { 'lid:bottom': notch, 'drawer:lid:left': notch } };
  const migrated = migrateLegacyLid(project);
  assert(JSON.stringify(Object.keys(migrated.pieceNotches)) === JSON.stringify(['horizontal-panel-1:bottom', 'drawer:lid:left']), `got ${JSON.stringify(Object.keys(migrated.pieceNotches))}`);
});

test('migrateLegacyLid() should move the lid images to the new panel, leaving the drawer sleeve lid images alone', () => {
  const image = [{ xMm: 1, yMm: 2, widthMm: 3, heightMm: 4, svg: '<svg/>' }];
  const project = { ...legacyProject(RECESSED_LID), pieceImages: { lid: image, 'drawer:lid': image } };
  const migrated = migrateLegacyLid(project);
  assert(JSON.stringify(Object.keys(migrated.pieceImages)) === JSON.stringify(['horizontal-panel-1', 'drawer:lid']), `got ${JSON.stringify(Object.keys(migrated.pieceImages))}`);
});

test('migrateLegacyLid() should keep an enabled onTop lid as the lid, with no panel and its holes untouched', () => {
  const holes = [{ xMm: 10, yMm: 10, widthMm: 5, heightMm: 5, radiusMm: 0 }];
  const project = { ...legacyProject({ enabled: true, mode: 'onTop', insertHeightMm: null }), pieceHoles: { lid: holes } };
  const migrated = migrateLegacyLid(project);
  assert(JSON.stringify(migrated.lid) === JSON.stringify({ enabled: true }), `got ${JSON.stringify(migrated.lid)}`);
  assert(migrated.horizontalPanels.length === 0, `got ${JSON.stringify(migrated.horizontalPanels)}`);
  assert(JSON.stringify(migrated.pieceHoles) === JSON.stringify({ lid: holes }), `got ${JSON.stringify(migrated.pieceHoles)}`);
});

test('migrateLegacyLid() should leave an already migrated project unchanged', () => {
  const project = { ...createDefaultProject(), lid: { enabled: true }, horizontalPanels: [{ id: 'horizontal-panel-1', heightMm: 20, coverage: null }] };
  const migrated = migrateLegacyLid(project);
  assert(JSON.stringify(migrated) === JSON.stringify(project), `got ${JSON.stringify({ lid: migrated.lid, horizontalPanels: migrated.horizontalPanels })}`);
});

test('migrateLegacyLid() should treat a lid saved before mode and coverage existed as a fully covering recessed lid', () => {
  const migrated = migrateLegacyLid(legacyProject({ enabled: true, insertHeightMm: 20 }));
  const [panel] = migrated.horizontalPanels;
  assert(panel && panel.heightMm === 20 && panel.coverage === null, `got ${JSON.stringify(migrated.horizontalPanels)}`);
});

test('migrateLegacyLid() should not turn a disabled recessed lid into a panel', () => {
  const migrated = migrateLegacyLid(legacyProject({ ...RECESSED_LID, enabled: false }));
  assert(JSON.stringify(migrated.lid) === JSON.stringify({ enabled: false }), `got ${JSON.stringify(migrated.lid)}`);
  assert(migrated.horizontalPanels.length === 0, `got ${JSON.stringify(migrated.horizontalPanels)}`);
});

test('migrateLegacyLid() should keep a recessed lid with no height yet as a panel with no height, for the panel settings to flag', () => {
  const migrated = migrateLegacyLid(legacyProject({ ...RECESSED_LID, insertHeightMm: null }));
  const [panel] = migrated.horizontalPanels;
  assert(panel && panel.heightMm === null, `got ${JSON.stringify(migrated.horizontalPanels)}`);
});

test('migrateLegacyLid() should throw on a lid that is not an object, instead of guessing what it meant', () => {
  let thrown = null;
  try { migrateLegacyLid(legacyProject(null)); } catch (err) { thrown = err; }
  assert(thrown && /lid/.test(thrown.message) && !(thrown instanceof TypeError), `expected an explicit error about the lid, got ${thrown}`);
});

run();
