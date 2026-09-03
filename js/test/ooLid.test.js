// Lid: verified directly against buildLid's own (still-live, unchanged)
// output, both the flush and recessed cases.
import { test, assert, run } from './testHarness.js';
import { createGrid } from '../model/Grid.js';
import { createDefaultProject } from '../state/Project.js';
import { enumerateWallRuns, xAt, yAt, isLidFlush } from '../model/GridQuery.js';
import { isOuterSegment } from '../model/Grid.js';
import { buildLid } from '../geometry/LidBuilder.js';
import { junctionExclusionRanges } from '../geometry/PanelBuilder.js';
import { FingerEdge } from '../geometry/oo/FingerEdge.js';
import { outerBoundarySide } from '../geometry/oo/OuterBoundary.js';
import { Lid } from '../geometry/oo/Lid.js';

function sameOutline(a, b) {
  const norm = (pts) => JSON.stringify(pts.map((p) => `${p.x.toFixed(6)},${p.y.toFixed(6)}`).sort());
  return norm(a) === norm(b);
}

/** Builds a Lid for `grid`/`project` the same way a future Box.build()
 *  will. Kept here (not yet in production code) since Box doesn't exist
 *  until the next step. */
function buildLidOO(grid, project) {
  const { lid } = project;
  if (!lid || !lid.enabled || lid.insertHeightMm == null) return null;
  const flush = isLidFlush(grid, project, lid.insertHeightMm);
  const protrude = !flush;

  const cols = grid.sx.length, rows = grid.sy.length;
  const W = xAt(grid, project, cols), D = yAt(grid, project, rows);
  const runs = enumerateWallRuns(grid, project);
  const outerRuns = runs.filter((run) => isOuterSegment(grid, run.kind, run.aPoint[0], run.aPoint[1]));
  const topRun = outerRuns.find((run) => run.kind === 'h' && run.r === 0);
  const bottomRun = outerRuns.find((run) => run.kind === 'h' && run.r === rows);
  const leftRun = outerRuns.find((run) => run.kind === 'v' && run.c === 0);
  const rightRun = outerRuns.find((run) => run.kind === 'v' && run.c === cols);
  const marginMm = project.outerThicknessMm;

  function side(run) {
    if (!run) return null;
    const exclusions = junctionExclusionRanges(run, grid, project);
    return new FingerEdge(outerBoundarySide({
      lengthMm: run.length, fingerJoint: project.fingerJoint, startWithFinger: run.kind === 'v',
      marginMm, protrude, exclusions,
    }));
  }
  const sign = protrude ? -1 : 1;
  const sides = {
    top: topRun ? { edge: side(topRun), axisPoint: (u) => ({ x: u, y: 0 }), inward: { x: 0, y: sign } } : null,
    right: rightRun ? { edge: side(rightRun), axisPoint: (u) => ({ x: W, y: u }), inward: { x: -sign, y: 0 } } : null,
    bottom: bottomRun ? { edge: side(bottomRun), axisPoint: (u) => ({ x: u, y: D }), inward: { x: 0, y: -sign } } : null,
    left: leftRun ? { edge: side(leftRun), axisPoint: (u) => ({ x: 0, y: u }), inward: { x: sign, y: 0 } } : null,
  };
  const margin = protrude ? 0 : marginMm;
  const margins = { top: margin, right: margin, bottom: margin, left: margin };

  return new Lid({ thicknessMm: project.outerThicknessMm, sides, widthMm: W, depthMm: D, margins });
}

test('buildLidOO returns null when the lid is disabled, same as buildLid', () => {
  const project = createDefaultProject();
  project.grid = createGrid([100], [80]);
  assert(buildLid(project.grid, project) === null);
  assert(buildLidOO(project.grid, project) === null);
});

test('toPiece(): matches buildLid exactly in the FLUSH case', () => {
  const project = createDefaultProject();
  project.grid = createGrid([100], [80]);
  project.outerThicknessMm = 3;
  project.outerHeightMm = 40;
  project.lid = { enabled: true, insertHeightMm: 40 - 3 };
  assert(isLidFlush(project.grid, project, project.lid.insertHeightMm), 'sanity check: this should actually be the flush case');

  const old = buildLid(project.grid, project);
  const mine = buildLidOO(project.grid, project).toPiece();
  assert(mine.id === 'lid' && mine.kind === 'lid' && mine.thicknessGroup === 'outer');
  assert(sameOutline(old.outline, mine.outline));
});

test('toPiece(): matches buildLid exactly in the RECESSED case', () => {
  const project = createDefaultProject();
  project.grid = createGrid([100], [80]);
  project.outerThicknessMm = 3;
  project.outerHeightMm = 40;
  project.lid = { enabled: true, insertHeightMm: 20 };
  assert(!isLidFlush(project.grid, project, project.lid.insertHeightMm), 'sanity check: this should actually be the recessed case');

  const old = buildLid(project.grid, project);
  const mine = buildLidOO(project.grid, project).toPiece();
  assert(sameOutline(old.outline, mine.outline));
});

run();
