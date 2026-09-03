// HalfLapNotch: an X-crossing notch whose depth (h = min of all 4 local
// heights touching the crossing, halved) is a pure, symmetric function of
// data both crossing runs already have independent access to via
// GridQuery — never a reference from one run to the other. The test below
// is the direct proof of that: two runs deriving the SAME crossing
// independently must agree. Equivalence against buildWallPanel's own
// X-crossing output was also verified extensively during migration; once
// the old pipeline was deleted at cutover, that comparison lost its oracle
// and was retired along with it.
import { test, assert, assertClose, run } from './testHarness.js';
import { createGrid } from '../model/Grid.js';
import { createDefaultProject } from '../state/Project.js';
import { enumerateWallRuns, junctionKindAt, xAt, yAt, heightProfile, heightAt } from '../model/GridQuery.js';
import { HalfLapNotch } from '../geometry/oo/HalfLapNotch.js';

function baseProject() {
  const project = createDefaultProject();
  project.grid = createGrid([80, 80], [80, 80]); // 2x2: one X crossing at the center
  project.outerThicknessMm = 3;
  project.innerThicknessMm = 2;
  project.outerHeightMm = 40;
  project.innerHeightMm = 35;
  return project;
}

test('toEdgeFragment: a flat {uStart,uEnd,depth} centered on positionMm, width widthMm', () => {
  const notch = new HalfLapNotch({ positionMm: 50, widthMm: 4, depthMm: 12 });
  const frag = notch.toEdgeFragment();
  assertClose(frag.uStart, 48, 1e-9);
  assertClose(frag.uEnd, 52, 1e-9);
  assertClose(frag.depth, 12, 1e-9);
});

test('atCrossing: depth is symmetric — swapping which side is "own" vs "other" gives the identical result (no reference needed, see the plan)', () => {
  const project = baseProject();
  const vRun = enumerateWallRuns(project.grid, project).find((r) => r.kind === 'v' && r.c === 1);
  const hRun = enumerateWallRuns(project.grid, project).find((r) => r.kind === 'h' && r.r === 1);

  const uV = yAt(project.grid, project, 1) - yAt(project.grid, project, vRun.rStart);
  const uH = xAt(project.grid, project, 1) - xAt(project.grid, project, hRun.cStart);
  const vCrossing = junctionKindAt(project.grid, 'v', 1, 1, false);
  const hCrossing = junctionKindAt(project.grid, 'h', 1, 1, false);

  const vSpans = heightProfile(vRun, project.grid, project);
  const hSpans = heightProfile(hRun, project.grid, project);
  const notchFromV = HalfLapNotch.atCrossing(uV, vCrossing, heightAt(vSpans, uV), project);
  const notchFromH = HalfLapNotch.atCrossing(uH, hCrossing, heightAt(hSpans, uH), project);

  assertClose(notchFromV.depthMm, notchFromH.depthMm, 1e-9, 'both dividers must agree on the exact same depth, computed independently');
});

run();
