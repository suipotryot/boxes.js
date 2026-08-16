const DEFAULT_MAX_SIZE = 30;

/**
 * Snapshot-based undo/redo: each entry is a JSON string, so push() always
 * deep-clones (mutating the caller's object afterwards can't corrupt a
 * saved snapshot) and undo/redo round-trip cleanly through JSON.parse.
 */
export class HistoryManager<T> {
  private past: string[] = [];
  private future: string[] = [];

  constructor(private readonly maxSize: number = DEFAULT_MAX_SIZE) {}

  /** Call with the state *before* a mutation, right before applying it. */
  push(state: T): void {
    this.past.push(JSON.stringify(state));
    if (this.past.length > this.maxSize) {
      this.past.shift();
    }
    this.future = [];
  }

  /** Returns the previous state, or null if there's nothing to undo. `current` is saved for redo. */
  undo(current: T): T | null {
    const snapshot = this.past.pop();
    if (snapshot === undefined) {
      return null;
    }
    this.future.push(JSON.stringify(current));
    return JSON.parse(snapshot) as T;
  }

  /** Returns the next state, or null if there's nothing to redo. `current` is saved back for undo. */
  redo(current: T): T | null {
    const snapshot = this.future.pop();
    if (snapshot === undefined) {
      return null;
    }
    this.past.push(JSON.stringify(current));
    return JSON.parse(snapshot) as T;
  }

  canUndo(): boolean {
    return this.past.length > 0;
  }

  canRedo(): boolean {
    return this.future.length > 0;
  }

  clear(): void {
    this.past = [];
    this.future = [];
  }
}
