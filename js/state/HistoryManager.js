// Linear undo/redo over immutable snapshots. Every mutation in this app
// (Grid.js's toggle*/set* functions) already returns a fresh object rather
// than mutating in place, so history is just "keep the old references
// around" — no diffing, no command objects to reverse.

const MAX_HISTORY = 200;

export function createHistoryManager(initialState) {
  let past = [];
  let current = initialState;
  let future = [];

  return {
    get current() {
      return current;
    },
    /** Records `current` as undoable, then makes `nextState` current.
     *  Clears the redo stack, same as any editor: redo only replays a
     *  branch you just undid from, not one you've since diverged from. */
    push(nextState) {
      past.push(current);
      if (past.length > MAX_HISTORY) past.shift();
      current = nextState;
      future = [];
    },
    undo() {
      if (past.length === 0) return current;
      future.push(current);
      current = past.pop();
      return current;
    },
    redo() {
      if (future.length === 0) return current;
      past.push(current);
      current = future.pop();
      return current;
    },
    canUndo() {
      return past.length > 0;
    },
    canRedo() {
      return future.length > 0;
    },
  };
}
