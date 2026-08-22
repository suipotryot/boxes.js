// Storage-agnostic project persistence — accepts any `storage` implementing
// just getItem/setItem/removeItem (real `window.localStorage`, or a plain
// in-memory fake in tests) so this stays unit-testable the same way every
// other pure module in this app is, without needing a browser.
//
// One JSON blob per project under `boxes.js:project:<id>`, plus a small
// index (`boxes.js:index`, an array of known ids) so list() never has to
// rely on Storage.key(i)/.length enumeration — a fake test storage only
// ever needs to implement the 3 methods above, nothing more.
const PROJECT_PREFIX = 'boxes.js:project:';
const INDEX_KEY = 'boxes.js:index';
const LAST_ACTIVE_KEY = 'boxes.js:last-active-id';
const AUTOSAVE_DELAY_KEY = 'boxes.js:autosave-delay-ms';
const DEFAULT_AUTOSAVE_DELAY_MS = 5000;
const MACHINE_SETTINGS_KEY = 'boxes.js:machine-settings';
const PREFERENCES_KEY = 'boxes.js:preferences';

// Matches createDefaultProject()'s own hardcoded values (js/state/Project.js)
// — a first-ever launch, before the user has touched "Ma machine" or
// "Préférences", behaves exactly as it did before those screens existed.
const DEFAULT_MACHINE_SETTINGS = { laserBed: { widthMm: 600, heightMm: 400, spacingMm: 5 }, burnMm: 0.1 };
const DEFAULT_PREFERENCES = { fingerJoint: { fingerMm: 10, spaceMm: 10, marginMm: 5, playMm: 0.1 } };

function readJson(storage, key, fallback) {
  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function readIndex(storage) {
  try {
    const raw = storage.getItem(INDEX_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeIndex(storage, ids) {
  storage.setItem(INDEX_KEY, JSON.stringify(ids));
}

export function createProjectRepository(storage = window.localStorage) {
  function load(id) {
    try {
      const raw = storage.getItem(PROJECT_PREFIX + id);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function getLastActiveId() {
    return storage.getItem(LAST_ACTIVE_KEY) || null;
  }

  function setLastActiveId(id) {
    if (id == null) storage.removeItem(LAST_ACTIVE_KEY);
    else storage.setItem(LAST_ACTIVE_KEY, id);
  }

  return {
    /** Saves a COPY of `project` — never mutates the argument. Reuses
     *  `project.id` if present, otherwise mints a fresh crypto.randomUUID()
     *  (in practice this only ever happens once per project, at the
     *  AppShell boundary where a project is first created/imported — the
     *  autosave loop always calls save() with an id already resolved, so
     *  it never mints a new id on every tick). Stamps `updatedAt` on the
     *  saved copy only, not on the live in-memory project the editor
     *  holds — otherwise every autosave tick would push a "just a
     *  timestamp changed" entry onto the undo/redo history. */
    save(project) {
      const id = project.id || crypto.randomUUID();
      const saved = { ...project, id, updatedAt: Date.now() };
      storage.setItem(PROJECT_PREFIX + id, JSON.stringify(saved));
      const index = readIndex(storage);
      if (!index.includes(id)) writeIndex(storage, [...index, id]);
      return saved;
    },

    /** Returns the saved project, or null (never throws) if absent or
     *  corrupted — a caller should treat both the same way: nothing
     *  usable is there. */
    load,

    /** Lightweight metadata for every saved project (id/name/updatedAt),
     *  most-recently-updated first — skips (never throws on) any entry
     *  that's missing or corrupted, so one bad blob can't break the whole
     *  list. */
    list() {
      const projects = [];
      for (const id of readIndex(storage)) {
        const project = load(id);
        if (project) projects.push({ id: project.id, name: project.name, updatedAt: project.updatedAt });
      }
      return projects.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    },

    remove(id) {
      storage.removeItem(PROJECT_PREFIX + id);
      writeIndex(storage, readIndex(storage).filter((existing) => existing !== id));
      if (getLastActiveId() === id) setLastActiveId(null);
    },

    getLastActiveId,
    setLastActiveId,

    getAutosaveDelayMs() {
      const raw = Number(storage.getItem(AUTOSAVE_DELAY_KEY));
      return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_AUTOSAVE_DELAY_MS;
    },

    setAutosaveDelayMs(ms) {
      storage.setItem(AUTOSAVE_DELAY_KEY, String(ms));
    },

    /** The user's one laser cutter — bed dimensions, spacing between
     *  pieces, and kerf/burn — pre-filled onto every NEW project so it
     *  never needs re-entering (AppShell.createAndOpenProject). Editing
     *  this afterward never touches already-created projects; each keeps
     *  its own copy. */
    getMachineSettings() {
      return readJson(storage, MACHINE_SETTINGS_KEY, DEFAULT_MACHINE_SETTINGS);
    },

    setMachineSettings(settings) {
      storage.setItem(MACHINE_SETTINGS_KEY, JSON.stringify(settings));
    },

    /** User-level defaults (currently just finger-joint dimensions)
     *  pre-filled onto every NEW project, same one-way prefill semantics
     *  as getMachineSettings above. */
    getPreferences() {
      return readJson(storage, PREFERENCES_KEY, DEFAULT_PREFERENCES);
    },

    setPreferences(prefs) {
      storage.setItem(PREFERENCES_KEY, JSON.stringify(prefs));
    },
  };
}
