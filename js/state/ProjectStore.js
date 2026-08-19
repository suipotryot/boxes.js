// Holds the current project, wires every mutation through HistoryManager,
// and notifies subscribers (the UI layer) after each change. No
// persistence here (that's M6) — this is purely in-memory state for the
// editor session.
import { createHistoryManager } from './HistoryManager.js';

export function createProjectStore(initialProject) {
  const history = createHistoryManager(initialProject);
  const listeners = new Set();

  function notify() {
    for (const listener of listeners) listener(history.current);
  }

  return {
    get project() {
      return history.current;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    /** Applies a pure `project -> project` updater and records the result
     *  as a new undoable state. Every editor mutation goes through this,
     *  never through direct assignment, so undo/redo stays complete. */
    apply(updater) {
      history.push(updater(history.current));
      notify();
    },
    undo() {
      history.undo();
      notify();
    },
    redo() {
      history.redo();
      notify();
    },
    canUndo: () => history.canUndo(),
    canRedo: () => history.canRedo(),
  };
}
