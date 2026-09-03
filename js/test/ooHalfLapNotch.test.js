// HalfLapNotch: verified directly against buildWallPanel's own (still-live,
// unchanged) X-crossing output — the private crossingNotchDepth/
// notchURange it reimplements aren't exported, so this reconstructs their
// exact formula from the exported primitives (heightAt, resolveHeight,
// resolveThickness) and checks the result lands exactly where the old
// pipeline actually cuts, on a real 2x2 grid with a genuine X crossing.
import { test, assert, assertClose, run } from './testHarness.js';
import { createGrid } from '../model/Grid.js';
import { createDefaultProject } from '../state/Project.js';
import { enumerateWallRuns, junctionKindAt, xAt, yAt } from '../model/GridQuery.js';
import { buildWallPanel, heightProfile, heightAt } from '../geometry/PanelBuilder.js';
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

test('atCrossing: for the vertical divider (notches from the top), matches exactly where buildWallPanel cuts today', () => {
  const project = baseProject();
  const run = enumerateWallRuns(project.grid, project).find((r) => r.kind === 'v' && r.c === 1);
  const old = buildWallPanel(run, project.grid, project, true);

  const uAtCrossing = yAt(project.grid, project, 1) - yAt(project.grid, project, run.rStart);
  const crossing = junctionKindAt(project.grid, 'v', 1, 1, false);
  assert(crossing.kind === 'crossing', 'sanity check: this should be a genuine X crossing');

  const spans = heightProfile(run, project.grid, project);
  const ownHeightAtU = heightAt(spans, uAtCrossing);
  const notch = HalfLapNotch.atCrossing(uAtCrossing, crossing, ownHeightAtU, project);

  assertClose(notch.positionMm, 81, 1e-9);
  assertClose(notch.widthMm, project.innerThicknessMm, 1e-9, 'width should be the CROSSING piece\'s own thickness');
  assertClose(notch.depthMm, 17.5, 1e-9, 'depth should be min(ownHeight, otherHeight)/2 = min(35,35)/2');

  const frag = notch.toEdgeFragment();
  const matching = old.outline.filter((p) => Math.abs(p.y - notch.depthMm) < 1e-6 && p.x >= frag.uStart - 1e-6 && p.x <= frag.uEnd + 1e-6);
  assert(matching.length >= 2, `expected the old outline to actually have points at the notch's own depth/range, found ${matching.length}`);
});

test('atCrossing: for the horizontal divider (notches from the bottom), the SAME formula still matches — direction-agnostic', () => {
  const project = baseProject();
  const run = enumerateWallRuns(project.grid, project).find((r) => r.kind === 'h' && r.r === 1);
  const old = buildWallPanel(run, project.grid, project, true);

  const uAtCrossing = xAt(project.grid, project, 1) - xAt(project.grid, project, run.cStart);
  const crossing = junctionKindAt(project.grid, 'h', 1, 1, false);
  assert(crossing.kind === 'crossing');

  const spans = heightProfile(run, project.grid, project);
  const ownHeightAtU = heightAt(spans, uAtCrossing);
  const notch = HalfLapNotch.atCrossing(uAtCrossing, crossing, ownHeightAtU, project);
  const frag = notch.toEdgeFragment();

  const matching = old.outline.filter((p) => Math.abs(p.y - notch.depthMm) < 1e-6 && p.x >= frag.uStart - 1e-6 && p.x <= frag.uEnd + 1e-6);
  assert(matching.length >= 2, `expected the old outline to have points at the notch's own depth/range on the h run too, found ${matching.length}`);
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
