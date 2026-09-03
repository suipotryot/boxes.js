// MortiseHole: verified directly against buildWallPanel's own (still-live,
// unchanged) T-junction output — mortiseHoles isn't exported, so this
// reconstructs it via a direct FingerJoint.fingerEdgePath call (the same
// "generated from the mate's own dents(), never recomputed independently"
// principle from the plan) and checks the resulting holes match exactly.
import { test, assert, run } from './testHarness.js';
import { createGrid } from '../model/Grid.js';
import { createDefaultProject } from '../state/Project.js';
import { enumerateWallRuns, junctionKindAt, xAt } from '../model/GridQuery.js';
import { buildWallPanel } from '../geometry/PanelBuilder.js';
import { fingerEdgePath } from '../geometry/FingerJoint.js';
import { MortiseHole } from '../geometry/oo/MortiseHole.js';

function sortedRounded(poly) {
  return poly.map((p) => `${p.x.toFixed(6)},${p.y.toFixed(6)}`).sort().join('|');
}

test('polygon(): wound bottom-left -> bottom-right -> top-right -> top-left, matching Hole\'s own convention', () => {
  const hole = new MortiseHole({ xMm: 10, yMm: 20, widthMm: 5, heightMm: 8 });
  const poly = hole.polygon();
  assert(poly.length === 4);
  assert(poly[0].x === 10 && poly[0].y === 20, 'bottom-left first');
  assert(poly[1].x === 15 && poly[1].y === 20, 'bottom-right second');
  assert(poly[2].x === 15 && poly[2].y === 28, 'top-right third');
  assert(poly[3].x === 10 && poly[3].y === 28, 'top-left fourth');
});

test('manyFromFingerSegments (axis=\'y\', the T-junction case): one hole per finger segment only, centered on centerMm, width = stem thickness', () => {
  const fj = { fingerMm: 10, spaceMm: 10, marginMm: 5, playMm: 0 };
  const segs = fingerEdgePath(50, fj, true);
  const fingerCount = segs.filter((s) => s.kind === 'finger').length;
  const holes = MortiseHole.manyFromFingerSegments(segs, { centerMm: 100, thicknessMm: 3 });
  assert(holes.length === fingerCount, `expected exactly one hole per finger segment (${fingerCount}), got ${holes.length}`);
  for (const h of holes) {
    assert(h.xMm === 100 - 1.5 && h.widthMm === 3, 'each hole should be centered on centerMm with the stem\'s own thickness as width');
  }
});

test('manyFromFingerSegments (axis=\'x\', the base-plate divider-hole case): transposed — tiling along X, thickness band in Y, offsetMm shifts the tiling origin', () => {
  const fj = { fingerMm: 10, spaceMm: 10, marginMm: 5, playMm: 0 };
  const segs = fingerEdgePath(50, fj, true);
  const holes = MortiseHole.manyFromFingerSegments(segs, { axis: 'x', centerMm: 20, thicknessMm: 2, offsetMm: 100 });
  for (const h of holes) {
    assert(h.yMm === 20 - 1 && h.heightMm === 2, 'the thickness band should be centered on centerMm in Y');
    assert(h.xMm >= 100, 'the tiling origin should be shifted by offsetMm');
  }
});

test('manyFromFingerSegments: matches buildWallPanel\'s own mortise holes exactly, on a real T-junction grid', () => {
  const project = createDefaultProject();
  project.grid = createGrid([80, 80], [100]); // T junction: divider at c=1 meets the top/bottom outer edges
  project.outerThicknessMm = 3;
  project.innerThicknessMm = 2;
  project.outerHeightMm = 40;
  project.innerHeightMm = 35;

  const throughRun = enumerateWallRuns(project.grid, project).find((r) => r.kind === 'h' && r.r === 0);
  const old = buildWallPanel(throughRun, project.grid, project, true);

  const uAtCrossing = xAt(project.grid, project, 1) - xAt(project.grid, project, throughRun.cStart);
  const crossing = junctionKindAt(project.grid, 'h', 1, 0, false);
  assert(crossing.kind === 'stem' && crossing.stems.length === 1, 'sanity check: this should be a single-stem T junction');

  const stemSeg = crossing.stems[0];
  const stemHeight = project.innerHeightMm; // resolveHeight-equivalent: no per-segment override here
  const stemThickness = project.innerThicknessMm;
  const stemStartWithFinger = throughRun.kind === 'h'; // matches the old mortiseHoles' own convention
  const segs = fingerEdgePath(stemHeight, project.fingerJoint, stemStartWithFinger);
  const holes = MortiseHole.manyFromFingerSegments(segs, { centerMm: uAtCrossing, thicknessMm: stemThickness });

  assert(holes.length === old.holes.length, `expected ${old.holes.length} holes, got ${holes.length}`);
  const oldSet = old.holes.map(sortedRounded).sort();
  const mineSet = holes.map((h) => sortedRounded(h.polygon())).sort();
  assert(JSON.stringify(oldSet) === JSON.stringify(mineSet), 'the generated mortise holes should match buildWallPanel\'s own point-for-point');
});

run();
