// Top-level screen router: "Mes projets" <-> "Ma machine" <-> "Préférences"
// <-> the editor, all mounted into the same container main.js hands off.
// Owns the ProjectRepository and the debounced-autosave wiring —
// ProjectStore itself stays persistence-agnostic (see its own header
// comment), so autosave is layered on entirely from here via
// store.subscribe(), one fresh debounce() instance per opened project.
//
// Routed with Backbone.Router (yes, just the Router/History piece — no
// Model/View/Collection anywhere in this app), hash-based (Backbone's own
// default when `pushState` isn't explicitly requested): this is a local
// tool that might be opened from any bare static file server, not just
// `vite preview` — a `#machine` URL always resolves to index.html
// regardless of hosting, with zero server-side SPA fallback config needed
// anywhere. This also fixes the real bug that prompted the switch: the
// browser's own back/forward buttons previously did nothing between our
// screens, because nothing ever pushed a history entry.
//
// A different router (navigo) was tried first and dropped after a real,
// reproducible bug: it sets an internal "freeze" flag after every
// navigate() call (meant to work around a scroll-restoration quirk in
// pushState mode) that also suppresses its popstate handling for a brief
// window even in hash mode — click a button, then hit the browser's back
// button quickly enough, and the URL changes but the screen silently
// doesn't. Backbone.History listens to `hashchange` directly in this
// configuration (not popstate), with no such timing-dependent internal
// state — confirmed by reading its source, not just its docs, the same
// way the navigo bug was actually found in the first place.
import { clear } from './dom.js';
import { createProjectRepository } from '../state/ProjectRepository.js';
import { createProjectStore } from '../state/ProjectStore.js';
import { createDefaultProject } from '../state/Project.js';
import { debounce } from '../state/debounce.js';
import { mountEditorView } from './EditorView.js';
import { mountProjectListView } from './ProjectListView.js';
import { mountMachineSettingsView } from './MachineSettingsView.js';
import { mountPreferencesView } from './PreferencesView.js';
import Backbone from 'backbone';

export function mountAppShell(container) {
  const repo = createProjectRepository();
  let current = null; // whichever screen's { unmount(), flush? } is live

  // A brand-new project is only assigned an id in memory when created —
  // it isn't written to storage until the first real edit reaches the
  // debounced autosave below (creating a project and closing the tab
  // without touching it leaves nothing behind, which is correct — nothing
  // meaningful happened yet). That means the editor route can't always
  // resolve a fresh project via repo.load() alone; this holds the
  // just-minted project in memory for exactly the one navigation that
  // follows createAndOpenProject(), so its URL still works like any
  // other's despite not existing in storage yet.
  let pendingNewProject = null;

  function mountScreen(mountFn, opts) {
    if (current) current.unmount();
    current = mountFn(container, opts);
  }

  // The project's id must be resolved BEFORE the store/autosave loop ever
  // starts — if it stayed null, every single autosave tick would mint a
  // fresh crypto.randomUUID() and write a brand-new orphaned localStorage
  // entry instead of updating the same one.
  function mountEditorScreen(project) {
    if (current) current.unmount();
    repo.setLastActiveId(project.id);

    const store = createProjectStore(project);
    const autosave = debounce((p) => repo.save(p), repo.getAutosaveDelayMs());
    const unsubscribe = store.subscribe((p) => autosave.call(p));

    const editor = mountEditorView(container, store, {
      onBackToList: () => {
        autosave.flush();
        router.navigate('list', { trigger: true });
      },
    });

    current = {
      flush: () => autosave.flush(),
      unmount() {
        autosave.flush();
        unsubscribe();
        editor.unmount();
      },
    };
  }

  // Pre-fills a brand-new project from the user's own saved "Ma machine"/
  // "Préférences" settings instead of createDefaultProject()'s hardcoded
  // literals — the merge happens here, at the one place a project is
  // actually minted, rather than inside createDefaultProject() itself,
  // which stays a pure function with no storage access (existing tests
  // rely on its exact hardcoded values). Never affects an
  // already-created project — this only runs once, at creation.
  function createAndOpenProject() {
    const base = createDefaultProject();
    const machine = repo.getMachineSettings();
    const prefs = repo.getPreferences();
    pendingNewProject = {
      ...base,
      laserBed: { ...base.laserBed, ...machine.laserBed },
      burnMm: machine.burnMm,
      fingerJoint: { ...base.fingerJoint, ...prefs.fingerJoint },
      id: crypto.randomUUID(),
    };
    router.navigate(`editor/${pendingNewProject.id}`, { trigger: true });
  }

  function openEditorRoute(id) {
    const project = repo.load(id)
      || (pendingNewProject && pendingNewProject.id === id ? pendingNewProject : null);
    pendingNewProject = null;
    if (project) mountEditorScreen(project);
    else router.navigate('list', { trigger: true, replace: true });
  }

  const router = new Backbone.Router({
    routes: {
      // The empty fragment is deliberately its OWN route, distinct from
      // 'list' — kept as a one-way redirect rather than the list's own
      // URL, precisely so an empty fragment can only ever mean "this page
      // was just loaded with no hash at all," never "the user is
      // deliberately looking at the list." Hash-mode Backbone can't tell
      // "no # in the URL" and "a # with nothing after it" apart — both
      // read back as fragment '' — so if 'list' itself used '', reloading
      // (or hitting back to) the list's own URL would look IDENTICAL to a
      // fresh app load and re-trigger the resume-last-active redirect
      // below, sending the user right back into whatever project they'd
      // just left. This is exactly the bug the user found.
      '': () => router.navigate('list', { trigger: true, replace: true }),
      list: () => mountScreen(mountProjectListView, {
        repo,
        onOpen: (id) => router.navigate(`editor/${id}`, { trigger: true }),
        onCreate: createAndOpenProject,
        onOpenMachine: () => router.navigate('machine', { trigger: true }),
        onOpenPreferences: () => router.navigate('preferences', { trigger: true }),
      }),
      // "Ma machine"/"Préférences" are only reachable from "Mes projets"
      // (see ProjectListView's own toolbar) — never from the editor. No
      // in-screen "back" button either: with real routing in place, the
      // browser's own back button already does that job.
      machine: () => mountScreen(mountMachineSettingsView, { repo }),
      preferences: () => mountScreen(mountPreferencesView, { repo }),
      'editor/:id': openEditorRoute,
    },
  });

  Backbone.history.on('notfound', () => router.navigate('list', { trigger: true, replace: true }));

  // Flushes whatever autosave is currently pending right before the tab
  // closes — without this, an edit made less than one debounce delay
  // before closing the tab would be silently lost. A no-op on any
  // non-editor screen (current.flush is only defined while one is
  // mounted).
  window.addEventListener('beforeunload', () => {
    if (current && current.flush) current.flush();
  });

  clear(container);

  // silent: true — start() would otherwise immediately resolve whatever
  // the current URL fragment is, before we get a chance to redirect to
  // the last-active project below. navigate() is a no-op until history
  // has started, so start() must always come first regardless of which
  // branch runs next.
  Backbone.history.start({ silent: true });

  // Resumes the last-active project only when the fragment is truly empty
  // — which, now that 'list' is its own route distinct from '' (see the
  // routes table above), can only mean a genuinely fresh app load, never
  // "the user is deliberately looking at the list" or reloading/
  // bookmarking/sharing a link to any OTHER screen (the editor's own
  // current project included). Both of those used to get silently
  // overridden by a redirect back to whatever project was last active —
  // reloading mid-edit even landed on a blank page at one point, because
  // Backbone.history.navigate() silently no-ops when the target fragment
  // already equals the current one, so the route handler never ran at
  // all. replace: true below so this doesn't leave "just opened the app"
  // as a separate back-button stop before the editor.
  const lastId = repo.getLastActiveId();
  if (!Backbone.history.fragment && lastId && repo.load(lastId)) {
    router.navigate(`editor/${lastId}`, { trigger: true, replace: true });
  } else {
    Backbone.history.loadUrl();
  }
}
