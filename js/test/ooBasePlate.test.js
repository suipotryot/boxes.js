// BasePlate: verified directly against buildBasePlate's own (still-live,
// unchanged) output — both its outline (via OuterBoundary, already
// verified on its own) and its divider holes (via MortiseHole, likewise).
import { test, assert, run } from './testHarness.js';
import { createGrid } from '../model/Grid.js';
import { createDefaultProject } from '../state/Project.js';
import { enumerateWallRuns, xAt, yAt } from '../model/GridQuery.js';
import { isOuterSegment } from '../model/Grid.js';
import { buildBasePlate } from '../geometry/BasePlateBuilder.js';
import { bottomCombSegments, junctionExclusionRanges } from '../geometry/PanelBuilder.js';
import { FingerEdge } from '../geometry/oo/FingerEdge.js';
import { outerBoundarySide } from '../geometry/oo/OuterBoundary.js';
import { MortiseHole } from '../geometry/oo/MortiseHole.js';
import { BasePlate } from '../geometry/oo/BasePlate.js';

function sortedRounded(poly) {
  return poly.map((p) => `${p.x.toFixed(6)},${p.y.toFixed(6)}`).sort().join('|');
}
function samePolySet(a, b) {
  return JSON.stringify(a.map(sortedRounded).sort()) === JSON.stringify(b.map(sortedRounded).sort());
}
function sameOutline(a, b) {
  const norm = (pts) => JSON.stringify(pts.map((p) => `${p.x.toFixed(6)},${p.y.toFixed(6)}`).sort());
  return norm(a) === norm(b);
}

/** Builds a BasePlate for `grid`/`project` the same way a future
 *  Box.build() will. Kept here (not yet in production code) since Box
 *  doesn't exist until the next step. */
function buildBasePlateOO(grid, project) {
  const cols = grid.sx.length, rows = grid.sy.length;
  const W = xAt(grid, project, cols), D = yAt(grid, project, rows);
  const runs = enumerateWallRuns(grid, project);
  const outerRuns = runs.filter((run) => isOuterSegment(grid, run.kind, run.aPoint[0], run.aPoint[1]));
  const innerRuns = runs.filter((run) => !isOuterSegment(grid, run.kind, run.aPoint[0], run.aPoint[1]));
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
      marginMm, protrude: false, exclusions,
    }));
  }
  const sides = {
    top: topRun ? { edge: side(topRun), axisPoint: (u) => ({ x: u, y: 0 }), inward: { x: 0, y: 1 } } : null,
    right: rightRun ? { edge: side(rightRun), axisPoint: (u) => ({ x: W, y: u }), inward: { x: -1, y: 0 } } : null,
    bottom: bottomRun ? { edge: side(bottomRun), axisPoint: (u) => ({ x: u, y: D }), inward: { x: 0, y: -1 } } : null,
    left: leftRun ? { edge: side(leftRun), axisPoint: (u) => ({ x: 0, y: u }), inward: { x: 1, y: 0 } } : null,
  };
  const margins = { top: marginMm, right: marginMm, bottom: marginMm, left: marginMm };

  const holes = innerRuns.flatMap((run) => {
    const segs = bottomCombSegments(run, grid, project);
    const thicknessMm = project.innerThicknessMm;
    return run.kind === 'v'
      ? MortiseHole.manyFromFingerSegments(segs, { axis: 'y', centerMm: xAt(grid, project, run.c), thicknessMm, offsetMm: yAt(grid, project, run.rStart) })
      : MortiseHole.manyFromFingerSegments(segs, { axis: 'x', centerMm: yAt(grid, project, run.r), thicknessMm, offsetMm: xAt(grid, project, run.cStart) });
  });

  return new BasePlate({ thicknessMm: project.outerThicknessMm, sides, widthMm: W, depthMm: D, margins, holes });
}

test('toPiece(): matches buildBasePlate exactly — outline AND divider holes — on a 2x2 grid', () => {
  const project = createDefaultProject();
  project.grid = createGrid([90, 130], [70, 100]);
  project.outerThicknessMm = 3;
  project.innerThicknessMm = 2;

  const old = buildBasePlate(project.grid, project);
  const mine = buildBasePlateOO(project.grid, project).toPiece();

  assert(mine.id === 'base-plate' && mine.kind === 'basePlate' && mine.thicknessGroup === 'outer');
  assert(sameOutline(old.outline, mine.outline), 'outline should match buildBasePlate exactly');
  assert(mine.holes.length === old.holes.length, `expected ${old.holes.length} divider holes, got ${mine.holes.length}`);
  assert(samePolySet(old.holes, mine.holes), 'divider holes should match buildBasePlate exactly, point-for-point');
});

test('toPiece(): matches buildBasePlate exactly for a single cell (no dividers, no divider holes)', () => {
  const project = createDefaultProject();
  project.grid = createGrid([100], [80]);
  project.outerThicknessMm = 3;

  const old = buildBasePlate(project.grid, project);
  const mine = buildBasePlateOO(project.grid, project).toPiece();
  assert(sameOutline(old.outline, mine.outline));
  assert(mine.holes.length === 0 && old.holes.length === 0);
});

run();
