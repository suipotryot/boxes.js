// outerBoundaryOutline/outerBoundarySide: the base plate/lid's own W×D
// perimeter outline, verified directly against BasePlateBuilder's own
// (still-live, unchanged, exported) buildOuterEdgeOutline — the strongest
// available check for the corner-merge behavior in particular, which is
// genuinely different from Panel.outline()'s own assembly (see this
// file's own header comment).
import { test, assert, run } from './testHarness.js';
import { createGrid, setSegmentPresent } from '../model/Grid.js';
import { createDefaultProject } from '../state/Project.js';
import { enumerateWallRuns, xAt, yAt } from '../model/GridQuery.js';
import { isOuterSegment } from '../model/Grid.js';
import { buildOuterEdgeOutline } from '../geometry/BasePlateBuilder.js';
import { junctionExclusionRanges } from '../geometry/PanelBuilder.js';
import { FingerEdge } from '../geometry/oo/FingerEdge.js';
import { outerBoundarySide, outerBoundaryOutline } from '../geometry/oo/OuterBoundary.js';

function sortedRounded(pts) {
  return pts.map((p) => `${p.x.toFixed(6)},${p.y.toFixed(6)}`).sort();
}
function sameOutline(a, b) {
  return JSON.stringify(sortedRounded(a)) === JSON.stringify(sortedRounded(b));
}

/** Builds the perimeter outline the same way a future Box.build() will —
 *  reading the 4 outer runs and configuring one FingerEdge per present
 *  side. Kept here (not yet in production code) since Box doesn't exist
 *  until the next step. */
function buildBoundary(grid, project, { protrude = false } = {}) {
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
  return outerBoundaryOutline(sides, W, D, { top: margin, right: margin, bottom: margin, left: margin });
}

test('matches buildOuterEdgeOutline exactly for a single-cell box, protrude=false (base plate/flush lid)', () => {
  const project = createDefaultProject();
  project.grid = createGrid([100], [80]);
  project.outerThicknessMm = 3;
  const old = buildOuterEdgeOutline(project.grid, project);
  const mine = buildBoundary(project.grid, project);
  assert(sameOutline(old, mine));
});

test('matches buildOuterEdgeOutline exactly for a single-cell box, protrude=true (recessed lid) — the tabs point the OPPOSITE way', () => {
  const project = createDefaultProject();
  project.grid = createGrid([100], [80]);
  project.outerThicknessMm = 3;
  const old = buildOuterEdgeOutline(project.grid, project, { protrude: true });
  const mine = buildBoundary(project.grid, project, { protrude: true });
  assert(sameOutline(old, mine));
});

test('matches buildOuterEdgeOutline exactly for a 2x2 grid with dividers touching the boundary mid-span (exercises exclusions on the boundary sides too)', () => {
  const project = createDefaultProject();
  project.grid = createGrid([90, 130], [70, 100]);
  project.outerThicknessMm = 3;
  project.innerThicknessMm = 2;
  const old = buildOuterEdgeOutline(project.grid, project);
  const mine = buildBoundary(project.grid, project);
  assert(sameOutline(old, mine));
});

test('matches buildOuterEdgeOutline exactly with an open side (no run at all) — the drawer sleeve\'s own scenario', () => {
  const project = createDefaultProject();
  project.grid = setSegmentPresent(createGrid([100], [80]), 'h', 0, 0, false); // disable the whole top wall
  project.outerThicknessMm = 3;
  const old = buildOuterEdgeOutline(project.grid, project);
  const mine = buildBoundary(project.grid, project);
  assert(sameOutline(old, mine));
});

run();
