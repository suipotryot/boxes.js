// enumerateSmoothFlatEdges: which compass sides of a flat piece (base
// plate/lid) have no outer wall run — the only sides a grip notch can be
// added to (see Assembly.buildBoundarySides' own openSide branch). Ordinary
// case (a plain box, every outer wall present) has none; a drawer's own
// openSide is the concrete case this exists for.
import { test, assert, run } from './testHarness.js';
import { createGrid, setSegmentPresent } from '../model/Grid.js';
import { createDefaultProject } from '../state/Project.js';
import { enumerateSmoothFlatEdges } from '../geometry/PieceContext.js';

test('enumerateSmoothFlatEdges: a plain, fully-walled box has no smooth edges on its base plate', () => {
  const project = createDefaultProject();
  project.grid = createGrid([100], [80]);
  assert(enumerateSmoothFlatEdges(project.grid, project, 'base-plate').length === 0, 'every outer wall is present, so there should be no open compass side');
});

test('enumerateSmoothFlatEdges: reports exactly the compass side whose outer wall is absent', () => {
  const project = createDefaultProject();
  project.grid = createGrid([100], [80]);
  project.grid = setSegmentPresent(project.grid, 'v', 1, 0, false); // remove the right outer wall

  const edges = enumerateSmoothFlatEdges(project.grid, project, 'base-plate');
  assert(edges.length === 1, `expected exactly one open compass side, got ${edges.length}`);
  assert(edges[0].compass === 'right', `expected the open side to be 'right', got '${edges[0].compass}'`);
  assert(Math.abs(edges[0].lengthMm - 80) < 1e-6, `expected the right side's own length to be the depth (80), got ${edges[0].lengthMm}`);
  assert(Math.abs(edges[0].capMm - 100) < 1e-6, `expected the right side's own depth cap to be the perpendicular extent (width, 100), got ${edges[0].capMm}`);
});

test('enumerateSmoothFlatEdges: returns nothing for a wall piece id (not base-plate/lid)', () => {
  const project = createDefaultProject();
  project.grid = createGrid([100], [80]);
  assert(enumerateSmoothFlatEdges(project.grid, project, 'wall-h-0-0').length === 0, 'a wall piece id has no flat-edge notion at all');
});

run();
