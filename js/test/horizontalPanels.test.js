import { test, assert, run } from './testHarness.js';
import { createGrid } from '../model/Grid.js';
import { createDefaultProject } from '../state/Project.js';
import { addHorizontalPanel, removeHorizontalPanel, updateHorizontalPanel, horizontalPanelNumber, heightBroughtIntoRange } from '../model/HorizontalPanels.js';

function boxProject() {
  const project = createDefaultProject();
  project.grid = createGrid([60], [30]);
  project.outerThicknessMm = 3;
  project.outerHeightMm = 40;
  return project;
}

test('addHorizontalPanel() should add a fully covering panel flush with the top of the walls', () => {
  const project = addHorizontalPanel(boxProject());
  assert(JSON.stringify(project.horizontalPanels) === JSON.stringify([{ id: 'horizontal-panel-1', heightMm: 40 - 3, coverage: null }]), `got ${JSON.stringify(project.horizontalPanels)}`);
});

test('addHorizontalPanel() should start the new panel one thickness lower when the lid rests on the walls', () => {
  const project = addHorizontalPanel({ ...boxProject(), lid: { enabled: true } });
  assert(project.horizontalPanels[0].heightMm === 40 - 3 - 3, `got ${project.horizontalPanels[0].heightMm}`);
});

test('addHorizontalPanel() should number the new panel after the highest existing one, so a deleted panel id in the middle is never reused', () => {
  const project = { ...boxProject(), horizontalPanels: [{ id: 'horizontal-panel-3', heightMm: 10, coverage: null }] };
  const ids = addHorizontalPanel(project).horizontalPanels.map((panel) => panel.id);
  assert(JSON.stringify(ids) === JSON.stringify(['horizontal-panel-3', 'horizontal-panel-4']), `got ${JSON.stringify(ids)}`);
});

test('removeHorizontalPanel() should drop the panel along with its holes and edge notches, leaving the other pieces alone', () => {
  const hole = [{ xMm: 10, yMm: 10, widthMm: 5, heightMm: 5, radiusMm: 0 }];
  const notch = [{ widthMm: 10, depthMm: 5, offsetMm: 5, radiusMm: 0 }];
  const project = {
    ...boxProject(),
    horizontalPanels: [{ id: 'horizontal-panel-1', heightMm: 10, coverage: null }, { id: 'horizontal-panel-2', heightMm: 20, coverage: null }],
    pieceHoles: { 'horizontal-panel-1': hole, 'horizontal-panel-2': hole, 'horizontal-panel-10': hole },
    pieceNotches: { 'horizontal-panel-1:bottom': notch, 'horizontal-panel-2:bottom': notch, 'horizontal-panel-10:top': notch },
  };
  const removed = removeHorizontalPanel(project, 'horizontal-panel-1');
  assert(JSON.stringify(removed.horizontalPanels.map((panel) => panel.id)) === JSON.stringify(['horizontal-panel-2']), `got ${JSON.stringify(removed.horizontalPanels)}`);
  assert(JSON.stringify(Object.keys(removed.pieceHoles)) === JSON.stringify(['horizontal-panel-2', 'horizontal-panel-10']), `got ${JSON.stringify(Object.keys(removed.pieceHoles))}`);
  assert(JSON.stringify(Object.keys(removed.pieceNotches)) === JSON.stringify(['horizontal-panel-2:bottom', 'horizontal-panel-10:top']), `got ${JSON.stringify(Object.keys(removed.pieceNotches))}`);
});

test('updateHorizontalPanel() should change only the given panel', () => {
  const project = {
    ...boxProject(),
    horizontalPanels: [{ id: 'horizontal-panel-1', heightMm: 10, coverage: null }, { id: 'horizontal-panel-2', heightMm: 20, coverage: null }],
  };
  const updated = updateHorizontalPanel(project, 'horizontal-panel-2', { coverage: { side: 'left', depthMm: 15 } });
  assert(JSON.stringify(updated.horizontalPanels) === JSON.stringify([
    { id: 'horizontal-panel-1', heightMm: 10, coverage: null },
    { id: 'horizontal-panel-2', heightMm: 20, coverage: { side: 'left', depthMm: 15 } },
  ]), `got ${JSON.stringify(updated.horizontalPanels)}`);
});

test('horizontalPanelNumber() should read the number a panel was given when created', () => {
  assert(horizontalPanelNumber({ id: 'horizontal-panel-12', heightMm: 10, coverage: null }) === 12);
});

test('heightBroughtIntoRange() should clamp a height into the valid range, and pick the highest height when none is set', () => {
  const range = { min: 10, max: 37 };
  const heights = [5, 20, 50, null].map((heightMm) => heightBroughtIntoRange(heightMm, range));
  assert(JSON.stringify(heights) === JSON.stringify([10, 20, 37, 37]), `got ${JSON.stringify(heights)}`);
});

run();
