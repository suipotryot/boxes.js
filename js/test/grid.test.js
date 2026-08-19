import { test, assert, assertClose, run } from './testHarness.js';
import { createGrid, resizeGrid, setSegmentHeight } from '../model/Grid.js';

test('resizeGrid keeps interior customization when the position stays interior', () => {
  let grid = createGrid([80, 80], [100]); // 2 cols x 1 row, one interior vertical divider
  grid = setSegmentHeight(grid, 'v', 1, 0, 42);

  const { grid: resized, lostCustomization } = resizeGrid(grid, [90, 70], [100]); // same shape, different mm
  assert(!lostCustomization, 'a same-shape resize should not report lost customization');
  assertClose(resized.vWalls[1][0].heightMm, 42, 1e-9, 'interior divider height should survive a same-shape resize');
});

test('resizeGrid reports loss and drops customization when a column disappears', () => {
  let grid = createGrid([80, 80, 80], [100]); // 3 cols: two interior dividers at c=1 and c=2
  grid = setSegmentHeight(grid, 'v', 1, 0, 33);

  const { grid: resized, lostCustomization } = resizeGrid(grid, [80], [100]); // shrink to 1 col: no interior dividers left
  assert(lostCustomization, 'dropping the column that held a customized divider should be reported as lost');
  assert(resized.vWalls.length === 2, 'resized grid should have the new column count');
});

test('resizeGrid always regenerates the outer perimeter as present/outer regardless of old customization', () => {
  let grid = createGrid([80, 80], [100]);
  const { grid: resized } = resizeGrid(grid, [50, 50], [60]);
  for (let c = 0; c <= 2; c++) {
    for (let r = 0; r < 1; r++) {
      if (c === 0 || c === 2) {
        assert(resized.vWalls[c][r].present, 'outer vertical wall must stay present after resize');
        assert(resized.vWalls[c][r].thicknessGroup === 'outer', 'outer vertical wall must stay in the outer group');
      }
    }
  }
});

run();
