import { test, assert, run } from './testHarness.js';
import { createProjectStore } from '../state/ProjectStore.js';
import { createDefaultProject } from '../state/Project.js';
import { toggleWall } from '../model/Grid.js';

test('apply mutates via the history manager and notifies subscribers', () => {
  const store = createProjectStore(createDefaultProject());
  let notifications = 0;
  store.subscribe(() => { notifications++; });

  store.apply((p) => ({ ...p, outerThicknessMm: 5 }));
  assert(store.project.outerThicknessMm === 5, 'apply should update the current project');
  assert(notifications === 1, 'subscribers should be notified once per apply');
  assert(store.canUndo(), 'a history entry should exist after apply');
});

test('undo/redo through the store round-trips a grid mutation', () => {
  const project = createDefaultProject();
  const store = createProjectStore(project);
  const before = project.grid.vWalls[1][0].present;

  store.apply((p) => ({ ...p, grid: toggleWall(p.grid, 'v', 1, 0) }));
  assert(store.project.grid.vWalls[1][0].present !== before, 'toggle should flip presence');

  store.undo();
  assert(store.project.grid.vWalls[1][0].present === before, 'undo should restore the original presence');

  store.redo();
  assert(store.project.grid.vWalls[1][0].present !== before, 'redo should reapply the toggle');
});

run();
