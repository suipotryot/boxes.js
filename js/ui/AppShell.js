// Top-level screen switcher (M6): "Mes projets" <-> the editor, both
// mounted into the same container main.js already hands off. Owns the
// ProjectRepository and the debounced-autosave wiring — ProjectStore
// itself stays persistence-agnostic (see its own header comment), so
// autosave is layered on entirely from here via store.subscribe(), one
// fresh debounce() instance per opened project.
import { clear } from './dom.js';
import { createProjectRepository } from '../state/ProjectRepository.js';
import { createProjectStore } from '../state/ProjectStore.js';
import { createDefaultProject } from '../state/Project.js';
import { debounce } from '../state/debounce.js';
import { mountEditorView } from './EditorView.js';
import { mountProjectListView } from './ProjectListView.js';

export function mountAppShell(container) {
  const repo = createProjectRepository();
  let current = null; // whichever screen's { unmount(), flush? } is live

  function showList() {
    if (current) current.unmount();
    current = mountProjectListView(container, {
      repo,
      onOpen: openProject,
      onCreate: createAndOpenProject,
    });
  }

  // The project's id must be resolved BEFORE the store/autosave loop ever
  // starts — if it stayed null, every single autosave tick would mint a
  // fresh crypto.randomUUID() and write a brand-new orphaned localStorage
  // entry instead of updating the same one. A brand-new project is only
  // assigned an id here, in memory; it isn't written to storage until the
  // first real edit reaches the debounced autosave below (creating a
  // project and closing the tab without touching it leaves nothing
  // behind, which is correct — nothing meaningful happened yet).
  function mountEditor(project) {
    if (current) current.unmount();
    repo.setLastActiveId(project.id);

    const store = createProjectStore(project);
    const autosave = debounce((p) => repo.save(p), repo.getAutosaveDelayMs());
    const unsubscribe = store.subscribe((p) => autosave.call(p));

    const editor = mountEditorView(container, store, {
      onBackToList: () => {
        autosave.flush();
        showList();
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

  function openProject(id) {
    const project = repo.load(id);
    if (project) mountEditor(project);
  }

  function createAndOpenProject() {
    mountEditor({ ...createDefaultProject(), id: crypto.randomUUID() });
  }

  // Flushes whatever autosave is currently pending right before the tab
  // closes — without this, an edit made less than one debounce delay
  // before closing the tab would be silently lost. A no-op on the list
  // screen (current.flush is only defined while an editor is mounted).
  window.addEventListener('beforeunload', () => {
    if (current && current.flush) current.flush();
  });

  clear(container);
  const lastId = repo.getLastActiveId();
  const resumed = lastId ? repo.load(lastId) : null;
  if (resumed) mountEditor(resumed);
  else showList();
}
