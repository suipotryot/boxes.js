// enumerateSmoothFlatEdges: which compass sides of a flat piece (base
// plate/lid) have no outer wall run — the only sides a grip notch can be
// added to (see Assembly.buildBoundarySides' own openSide branch). Ordinary
// case (a plain box, every outer wall present) has none; a drawer's own
// openSide is the concrete case this exists for.
import { test, assert, run } from './testHarness.js';
import { createGrid, setSegmentPresent } from '../model/Grid.js';
import { createDefaultProject } from '../state/Project.js';
import { enumerateSmoothFlatEdges, resolvePieceHoleContext } from '../geometry/PieceContext.js';

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

test('resolvePieceHoleContext() should size a partial horizontal panel to its coverage rectangle, so its holes are validated inside the strip', () => {
  const project = createDefaultProject();
  project.grid = createGrid([60], [30]);
  project.horizontalPanels = [{ id: 'horizontal-panel-1', heightMm: 20, coverage: { side: 'left', depthMm: 12 } }];
  const { kind, widthMm, heightMm } = resolvePieceHoleContext(project, 'horizontal-panel-1');
  assert(kind === 'flat' && widthMm === 12 && heightMm === 30, `expected a 12x30 flat piece, got ${kind} ${widthMm}x${heightMm}`);
});

test('resolvePieceHoleContext() should not resolve the id of a horizontal panel that no longer exists', () => {
  const project = createDefaultProject();
  project.grid = createGrid([60], [30]);
  project.horizontalPanels = [{ id: 'horizontal-panel-1', heightMm: 20, coverage: null }];
  assert(resolvePieceHoleContext(project, 'horizontal-panel-2') === null, 'expected a stale panel id to resolve to nothing');
});

test('resolvePieceHoleContext() should not resolve the lid while it is disabled, since there is no lid piece to edit', () => {
  const project = createDefaultProject();
  assert(resolvePieceHoleContext(project, 'lid') === null, 'expected a disabled lid to resolve to nothing');
});

test('resolvePieceHoleContext() should not resolve a horizontal panel whose height is not set, since it is not built', () => {
  const project = createDefaultProject();
  project.horizontalPanels = [{ id: 'horizontal-panel-1', heightMm: null, coverage: null }];
  assert(resolvePieceHoleContext(project, 'horizontal-panel-1') === null, 'expected a panel with no height to resolve to nothing');
});

run();
