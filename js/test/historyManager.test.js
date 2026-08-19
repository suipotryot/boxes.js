import { test, assert, run } from './testHarness.js';
import { createHistoryManager } from '../state/HistoryManager.js';

test('undo restores the previous state, redo replays it', () => {
  const h = createHistoryManager('a');
  h.push('b');
  h.push('c');
  assert(h.current === 'c', 'current should be the latest push');
  assert(h.undo() === 'b', 'undo should return to the previous state');
  assert(h.undo() === 'a', 'undo should return to the initial state');
  assert(h.undo() === 'a', 'undoing past the start is a no-op, not an error');
  assert(h.redo() === 'b', 'redo should replay forward');
  assert(h.redo() === 'c', 'redo should reach the latest state');
});

test('a new push after an undo clears the redo stack', () => {
  const h = createHistoryManager('a');
  h.push('b');
  h.undo();
  h.push('c'); // diverges from the 'b' branch
  assert(!h.canRedo(), 'redo should be unavailable after diverging with a new push');
  assert(h.current === 'c');
});

test('canUndo/canRedo reflect stack state', () => {
  const h = createHistoryManager('a');
  assert(!h.canUndo() && !h.canRedo(), 'a fresh history has nothing to undo or redo');
  h.push('b');
  assert(h.canUndo() && !h.canRedo());
  h.undo();
  assert(!h.canUndo() && h.canRedo());
});

run();
