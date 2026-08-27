import { test, assert, assertClose, run } from './testHarness.js';
import { createProjectRepository } from '../state/ProjectRepository.js';
import { createDefaultProject } from '../state/Project.js';

function createFakeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

test('save() assigns a fresh id when project.id is null', () => {
  const repo = createProjectRepository(createFakeStorage());
  const saved = repo.save(createDefaultProject());
  assert(typeof saved.id === 'string' && saved.id.length > 0, 'expected a generated id');
});

test('save() reuses the existing id on subsequent saves instead of minting a new one', () => {
  const repo = createProjectRepository(createFakeStorage());
  const first = repo.save(createDefaultProject());
  const second = repo.save({ ...first, name: 'renamed' });
  assert(second.id === first.id, 'expected the same id to be reused');
});

test("save() stamps updatedAt on the returned copy without mutating the caller's project object", () => {
  const repo = createProjectRepository(createFakeStorage());
  const project = createDefaultProject();
  const saved = repo.save(project);
  assert(project.updatedAt === null, "the original object's updatedAt should stay untouched");
  assert(typeof saved.updatedAt === 'number', 'the saved copy should have a numeric updatedAt');
});

test('load() returns the previously saved project by id', () => {
  const repo = createProjectRepository(createFakeStorage());
  const saved = repo.save(createDefaultProject('mon projet'));
  const loaded = repo.load(saved.id);
  assert(loaded.name === 'mon projet');
  assert(loaded.id === saved.id);
});

test('load() returns null for an unknown id', () => {
  const repo = createProjectRepository(createFakeStorage());
  assert(repo.load('does-not-exist') === null);
});

test('load() returns null, not a throw, for a corrupted stored blob', () => {
  const storage = createFakeStorage();
  storage.setItem('boxes.js:project:bad-id', '{ not valid json');
  const repo = createProjectRepository(storage);
  assert(repo.load('bad-id') === null);
});

test('load() backfills a field missing from an older saved blob (created before that field existed)', () => {
  const storage = createFakeStorage();
  const project = createDefaultProject('ancien projet');
  project.id = 'old-id';
  delete project.drawer; // simulates a project saved before `drawer` was added
  storage.setItem('boxes.js:project:old-id', JSON.stringify(project));
  const repo = createProjectRepository(storage);
  const loaded = repo.load('old-id');
  assert(loaded.drawer && typeof loaded.drawer === 'object', 'a missing field should be backfilled from createDefaultProject(), not left undefined');
  assert(loaded.drawer.enabled === false, 'the backfilled value should match createDefaultProject()\'s own default');
  assert(loaded.name === 'ancien projet', 'fields actually present in the saved blob must not be overwritten by the defaults');
});

test('list() returns metadata for every saved project, most-recently-updated first', () => {
  const storage = createFakeStorage();
  const repo = createProjectRepository(storage);
  const a = repo.save(createDefaultProject('A'));
  const b = repo.save(createDefaultProject('B'));
  // Overwrite updatedAt directly so ordering is deterministic, not
  // dependent on real clock resolution between the two save() calls.
  storage.setItem('boxes.js:project:' + a.id, JSON.stringify({ ...a, updatedAt: 100 }));
  storage.setItem('boxes.js:project:' + b.id, JSON.stringify({ ...b, updatedAt: 200 }));
  const list = repo.list();
  assert(list.length === 2);
  assert(list[0].id === b.id, 'the most recently updated project should come first');
  assert(list[1].id === a.id);
});

test('list() skips a corrupted entry instead of throwing', () => {
  const storage = createFakeStorage();
  const repo = createProjectRepository(storage);
  const ok = repo.save(createDefaultProject('OK'));
  storage.setItem('boxes.js:index', JSON.stringify([ok.id, 'corrupted-id']));
  storage.setItem('boxes.js:project:corrupted-id', 'not json at all');
  const list = repo.list();
  assert(list.length === 1 && list[0].id === ok.id, 'the corrupted entry should be silently skipped');
});

test('remove() deletes the project so load() and list() no longer see it', () => {
  const repo = createProjectRepository(createFakeStorage());
  const saved = repo.save(createDefaultProject());
  repo.remove(saved.id);
  assert(repo.load(saved.id) === null);
  assert(repo.list().length === 0);
});

test('remove() clears the last-active pointer when it pointed at the removed project', () => {
  const repo = createProjectRepository(createFakeStorage());
  const saved = repo.save(createDefaultProject());
  repo.setLastActiveId(saved.id);
  repo.remove(saved.id);
  assert(repo.getLastActiveId() === null);
});

test('remove() leaves the last-active pointer alone when it points elsewhere', () => {
  const repo = createProjectRepository(createFakeStorage());
  const a = repo.save(createDefaultProject('A'));
  const b = repo.save(createDefaultProject('B'));
  repo.setLastActiveId(b.id);
  repo.remove(a.id);
  assert(repo.getLastActiveId() === b.id);
});

test('getLastActiveId()/setLastActiveId() round-trip, defaulting to null when never set', () => {
  const repo = createProjectRepository(createFakeStorage());
  assert(repo.getLastActiveId() === null);
  repo.setLastActiveId('abc');
  assert(repo.getLastActiveId() === 'abc');
  repo.setLastActiveId(null);
  assert(repo.getLastActiveId() === null);
});

test('getAutosaveDelayMs() returns 5000 by default when never set', () => {
  const repo = createProjectRepository(createFakeStorage());
  assertClose(repo.getAutosaveDelayMs(), 5000, 1e-9);
});

test('setAutosaveDelayMs()/getAutosaveDelayMs() round-trip', () => {
  const repo = createProjectRepository(createFakeStorage());
  repo.setAutosaveDelayMs(1500);
  assertClose(repo.getAutosaveDelayMs(), 1500, 1e-9);
});

test('getMachineSettings() returns createDefaultProject()\'s own values when never set', () => {
  const repo = createProjectRepository(createFakeStorage());
  const machine = repo.getMachineSettings();
  const defaults = createDefaultProject();
  assert(machine.laserBed.widthMm === defaults.laserBed.widthMm);
  assert(machine.laserBed.heightMm === defaults.laserBed.heightMm);
  assert(machine.laserBed.spacingMm === defaults.laserBed.spacingMm);
  assertClose(machine.burnMm, defaults.burnMm, 1e-9);
});

test('setMachineSettings()/getMachineSettings() round-trip', () => {
  const repo = createProjectRepository(createFakeStorage());
  repo.setMachineSettings({ laserBed: { widthMm: 900, heightMm: 600, spacingMm: 3 }, burnMm: 0.15 });
  const machine = repo.getMachineSettings();
  assert(machine.laserBed.widthMm === 900);
  assert(machine.laserBed.heightMm === 600);
  assert(machine.laserBed.spacingMm === 3);
  assertClose(machine.burnMm, 0.15, 1e-9);
});

test('getPreferences() returns createDefaultProject()\'s own fingerJoint values when never set', () => {
  const repo = createProjectRepository(createFakeStorage());
  const prefs = repo.getPreferences();
  const defaults = createDefaultProject();
  assert(prefs.fingerJoint.fingerMm === defaults.fingerJoint.fingerMm);
  assert(prefs.fingerJoint.spaceMm === defaults.fingerJoint.spaceMm);
  assert(prefs.fingerJoint.marginMm === defaults.fingerJoint.marginMm);
  assertClose(prefs.fingerJoint.playMm, defaults.fingerJoint.playMm, 1e-9);
});

test('setPreferences()/getPreferences() round-trip', () => {
  const repo = createProjectRepository(createFakeStorage());
  repo.setPreferences({ fingerJoint: { fingerMm: 8, spaceMm: 8, marginMm: 4, playMm: 0.2 } });
  const prefs = repo.getPreferences();
  assert(prefs.fingerJoint.fingerMm === 8);
  assert(prefs.fingerJoint.spaceMm === 8);
  assert(prefs.fingerJoint.marginMm === 4);
  assertClose(prefs.fingerJoint.playMm, 0.2, 1e-9);
});

test('getLocale() falls back to the injected detectLocale() when nothing is stored', () => {
  const repo = createProjectRepository(createFakeStorage(), () => 'en');
  assert(repo.getLocale() === 'en');
});

test('getLocale() falls back to "fr" when nothing is stored and detectLocale() finds nothing', () => {
  const repo = createProjectRepository(createFakeStorage(), () => null);
  assert(repo.getLocale() === 'fr');
});

test('setLocale()/getLocale() round-trip, taking priority over detectLocale()', () => {
  const repo = createProjectRepository(createFakeStorage(), () => 'en');
  repo.setLocale('fr');
  assert(repo.getLocale() === 'fr');
});

run();
