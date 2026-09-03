// Panel: assembles 4 Edge instances into one closed contour. Verified by
// direct equivalence against buildWallPanel's own (still-live, unchanged)
// output — the strongest check available before Box exists to build these
// automatically, and the only way to be sure the baseline/sign/axis
// placement in each edge slot is actually right rather than merely
// plausible (see FingerEdge.js's own comment on why that placement is
// configured per-instance rather than inferred by Panel).
import { test, assert, run } from './testHarness.js';
import { createGrid } from '../model/Grid.js';
import { createDefaultProject } from '../state/Project.js';
import { enumerateWallRuns } from '../model/GridQuery.js';
import { buildWallPanel, heightProfile, junctionExclusionRanges } from '../geometry/PanelBuilder.js';
import { Panel } from '../geometry/oo/Panel.js';
import { SmoothEdge } from '../geometry/oo/SmoothEdge.js';
import { FingerEdge } from '../geometry/oo/FingerEdge.js';
import { Notch } from '../geometry/oo/Notch.js';

function sortedRounded(pts) {
  return pts.map((p) => `${p.x.toFixed(6)},${p.y.toFixed(6)}`).sort();
}

function sameOutline(a, b) {
  return JSON.stringify(sortedRounded(a)) === JSON.stringify(sortedRounded(b));
}

/** Builds a Panel for `run` the same way a future Box.build() will —
 *  reading the run's own resolved thickness/height/junction data and
 *  configuring each of the 4 edges' baseline/sign for its slot. Kept here
 *  (not yet in production code) since Box doesn't exist until the next
 *  step; this is exactly the wiring that step will formalize. */
function buildPanel(run, grid, project, { fragments = [] } = {}) {
  const fj = project.fingerJoint;
  const spans = heightProfile(run, grid, project);
  const extendToTips = run.seg.thicknessGroup === 'outer';
  const startWithFinger = run.kind === 'v';

  const bottomEdge = new FingerEdge({
    lengthMm: run.length, fingerJoint: fj, startWithFinger,
    mateThicknessMm: project.outerThicknessMm, baselineMm: 0, signMm: -1,
    exclusions: junctionExclusionRanges(run, grid, project),
  });
  const rightEdge = new FingerEdge({
    lengthMm: spans[spans.length - 1].height, fingerJoint: fj, startWithFinger,
    mateThicknessMm: project.outerThicknessMm, extendToTips, baselineMm: run.length, signMm: 1,
  });
  const topEdge = new SmoothEdge({ lengthMm: run.length, heightProfile: spans, fragments });
  const leftEdge = new FingerEdge({
    lengthMm: spans[0].height, fingerJoint: fj, startWithFinger,
    mateThicknessMm: project.outerThicknessMm, extendToTips, baselineMm: 0, signMm: -1,
  });

  return new Panel({ id: 'x', kind: 'wall', bottomEdge, rightEdge, topEdge, leftEdge });
}

test('outline(): matches buildWallPanel exactly for a horizontal outer wall, single cell, no lid/notches', () => {
  const project = createDefaultProject();
  project.grid = createGrid([100], [80]);
  project.outerThicknessMm = 3;
  project.outerHeightMm = 40;
  const run = enumerateWallRuns(project.grid, project).find((r) => r.kind === 'h' && r.r === 0);

  const old = buildWallPanel(run, project.grid, project, true);
  const mine = buildPanel(run, project.grid, project).outline();
  assert(sameOutline(old.outline, mine), 'outline should match buildWallPanel point-for-point (as a set)');
});

test('outline(): matches buildWallPanel exactly for a vertical outer wall (opposite startWithFinger phase)', () => {
  const project = createDefaultProject();
  project.grid = createGrid([100], [80]);
  project.outerThicknessMm = 3;
  project.outerHeightMm = 40;
  const run = enumerateWallRuns(project.grid, project).find((r) => r.kind === 'v' && r.c === 0);

  const old = buildWallPanel(run, project.grid, project, true);
  const mine = buildPanel(run, project.grid, project).outline();
  assert(sameOutline(old.outline, mine));
});

test('outline(): matches buildWallPanel exactly for an interior divider (no tip-extension, different thickness/height)', () => {
  const project = createDefaultProject();
  project.grid = createGrid([80, 80], [100]);
  project.outerThicknessMm = 3;
  project.innerThicknessMm = 2;
  project.outerHeightMm = 40;
  project.innerHeightMm = 35;
  const run = enumerateWallRuns(project.grid, project).find((r) => r.kind === 'v' && r.c === 1);

  const old = buildWallPanel(run, project.grid, project, true);
  const mine = buildPanel(run, project.grid, project).outline();
  assert(sameOutline(old.outline, mine));
});

test('outline(): matches buildWallPanel exactly for an outer wall with a mid-run T-junction stem (a divider touching it mid-span) — the exact gap exclusions were added to close', () => {
  const project = createDefaultProject();
  project.grid = createGrid([90, 130], [70, 100]); // 2x2 grid
  project.outerThicknessMm = 3;
  project.innerThicknessMm = 2;
  const run = enumerateWallRuns(project.grid, project).find((r) => r.kind === 'h' && r.r === 0);

  const old = buildWallPanel(run, project.grid, project, true);
  const mine = buildPanel(run, project.grid, project).outline();
  assert(sameOutline(old.outline, mine));
});

test('outline(): matches buildWallPanel exactly with a rounded grip notch merged into the free edge', () => {
  const project = createDefaultProject();
  project.grid = createGrid([150], [100]);
  project.outerThicknessMm = 3;
  project.outerHeightMm = 50;
  project.pieceNotches = { 'wall-h-0-0': [{ widthMm: 30, depthMm: 10, offsetMm: 20, radiusMm: 5 }] };
  const run = enumerateWallRuns(project.grid, project).find((r) => r.kind === 'h' && r.r === 0);

  const old = buildWallPanel(run, project.grid, project, true);
  const notch = new Notch({ widthMm: 30, depthMm: 10, offsetMm: 20, radiusMm: 5 });
  const fragments = [notch.toEdgeFragment(project.outerHeightMm)];
  const mine = buildPanel(run, project.grid, project, { fragments }).outline();
  assert(sameOutline(old.outline, mine));
});

test('toPiece(): produces the same {id,kind,thicknessGroup,thicknessMm,outline,holes} shape existing downstream code expects', () => {
  const bottomEdge = new FingerEdge({ lengthMm: 100, fingerJoint: { fingerMm: 20, spaceMm: 20, marginMm: 5 }, startWithFinger: true, mateThicknessMm: 3, baselineMm: 0, signMm: -1 });
  const rightEdge = new FingerEdge({ lengthMm: 40, fingerJoint: { fingerMm: 20, spaceMm: 20, marginMm: 5 }, startWithFinger: true, mateThicknessMm: 3, extendToTips: true, baselineMm: 100, signMm: 1 });
  const topEdge = new SmoothEdge({ lengthMm: 100, heightProfile: [{ uStart: 0, uEnd: 100, height: 40 }] });
  const leftEdge = new FingerEdge({ lengthMm: 40, fingerJoint: { fingerMm: 20, spaceMm: 20, marginMm: 5 }, startWithFinger: true, mateThicknessMm: 3, extendToTips: true, baselineMm: 0, signMm: -1 });
  const panel = new Panel({ id: 'wall-h-0-0', kind: 'wall', thicknessGroup: 'outer', thicknessMm: 3, bottomEdge, rightEdge, topEdge, leftEdge });

  const piece = panel.toPiece();
  assert(piece.id === 'wall-h-0-0');
  assert(piece.kind === 'wall');
  assert(piece.thicknessGroup === 'outer');
  assert(piece.thicknessMm === 3);
  assert(Array.isArray(piece.outline) && piece.outline.length > 0);
  assert(Array.isArray(piece.holes) && piece.holes.length === 0);
});

run();
