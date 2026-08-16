import { describe, expect, it } from 'vitest';

import { HistoryManager } from '../HistoryManager';

describe('HistoryManager', () => {
  it('starts with nothing to undo or redo', () => {
    const history = new HistoryManager<{ n: number }>();
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(false);
  });

  it('undo returns the previously pushed state and moves current into redo', () => {
    const history = new HistoryManager<{ n: number }>();
    history.push({ n: 1 });
    const undone = history.undo({ n: 2 });
    expect(undone).toEqual({ n: 1 });
    expect(history.canRedo()).toBe(true);
  });

  it('redo replays what undo moved into the future stack', () => {
    const history = new HistoryManager<{ n: number }>();
    history.push({ n: 1 });
    const undone = history.undo({ n: 2 })!;
    const redone = history.redo(undone);
    expect(redone).toEqual({ n: 2 });
    expect(history.canRedo()).toBe(false);
  });

  it('undo returns null and changes nothing when there is no history', () => {
    const history = new HistoryManager<{ n: number }>();
    expect(history.undo({ n: 1 })).toBeNull();
  });

  it('redo returns null when there is nothing to redo', () => {
    const history = new HistoryManager<{ n: number }>();
    expect(history.redo({ n: 1 })).toBeNull();
  });

  it('a fresh push clears the redo stack (no redo after a new action post-undo)', () => {
    const history = new HistoryManager<{ n: number }>();
    history.push({ n: 1 });
    history.undo({ n: 2 });
    history.push({ n: 3 }); // a new action after undoing
    expect(history.canRedo()).toBe(false);
  });

  it('deep-clones via JSON round-trip: mutating the original object after push does not affect the snapshot', () => {
    const history = new HistoryManager<{ nested: { n: number } }>();
    const state = { nested: { n: 1 } };
    history.push(state);
    state.nested.n = 999; // mutate after pushing
    const undone = history.undo({ nested: { n: 2 } });
    expect(undone).toEqual({ nested: { n: 1 } });
  });

  it('caps history at maxSize, discarding the oldest entries', () => {
    const history = new HistoryManager<{ n: number }>(3);
    history.push({ n: 1 });
    history.push({ n: 2 });
    history.push({ n: 3 });
    history.push({ n: 4 }); // pushes past the cap, {n:1} should be dropped

    const u1 = history.undo({ n: 5 })!;
    const u2 = history.undo(u1)!;
    const u3 = history.undo(u2)!;
    expect([u1, u2, u3]).toEqual([{ n: 4 }, { n: 3 }, { n: 2 }]);
    expect(history.canUndo()).toBe(false); // {n:1} was evicted
  });

  it('clear empties both stacks', () => {
    const history = new HistoryManager<{ n: number }>();
    history.push({ n: 1 });
    history.undo({ n: 2 });
    history.clear();
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(false);
  });
});
