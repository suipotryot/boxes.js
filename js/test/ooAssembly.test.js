// Assembly: orchestrates walls + base plate + lid from Grid/Project. This
// file's own end-to-end equivalence coverage (formerly ooBox.test.js/
// ooEquivalence.test.js, comparing against the old procedural pipeline)
// was retired at the step-8 cutover once that pipeline was deleted — see
// the plan. This file instead holds targeted regression tests for bugs
// found post-cutover, exercising Assembly's own exported builders
// directly.
import { test, assert, assertClose, run } from './testHarness.js';
import { createGrid, setSegmentHeight } from '../model/Grid.js';
import { createDefaultProject } from '../state/Project.js';
import { enumerateWallRuns, heightProfile, heightAt } from '../model/GridQuery.js';
import { buildWallPiece, buildLid } from '../geometry/oo/Assembly.js';

test('a mortise hole at a T junction is capped by the through-piece\'s own LOCAL height, not just the stem\'s own height — a stem taller than a locally-reduced through-piece must not poke a hole past its edge', () => {
  const project = createDefaultProject();
  project.grid = createGrid([80, 80], [100]); // 2x1: one interior v-divider, T-junctions at its top/bottom ends
  project.outerThicknessMm = 3;
  project.innerThicknessMm = 2;
  project.outerHeightMm = 40;
  project.innerHeightMm = 35; // the stem's own height: taller than the reduced through-height below
  project.grid = setSegmentHeight(project.grid, 'h', 0, 0, 20); // reduce ONLY c=0 of the top outer run

  const topRun = enumerateWallRuns(project.grid, project).find((r) => r.kind === 'h' && r.r === 0);
  const spans = heightProfile(topRun, project.grid, project);
  const uAtJunction = spans[0].uEnd; // the c=0/c=1 boundary, where the divider's top end lands
  const localHeight = heightAt(spans, uAtJunction);
  assert(localHeight === 20, `sanity check: the through-piece's own local height at the junction should be the reduced 20mm, got ${localHeight}`);

  const piece = buildWallPiece(topRun, project.grid, project).toPiece();
  assert(piece.holes.length > 0, 'sanity check: this scenario should actually produce mortise holes to check');
  for (const hole of piece.holes) {
    for (const pt of hole) {
      assert(pt.y <= localHeight + 1e-9, `mortise hole point y=${pt.y} exceeds the through-piece's own local height (${localHeight}) at the junction — it pokes past the piece's own edge`);
    }
  }
});

// Lid modes: 'recessed' (mid-height mortise holes, walls unaffected at the
// very top) vs 'onTop' (the walls' own top edge ADDS fingers beyond their
// nominal height instead — see Assembly.buildWallPiece/buildLid, and the
// plan's account of the now-retired "flush" case that used to carve into
// the wall's own existing height budget instead of adding to it).

function lidFixtureProject() {
  const project = createDefaultProject();
  project.grid = createGrid([100], [100]); // single cell: no interior dividers to complicate the boundary
  project.outerThicknessMm = 3;
  project.outerHeightMm = 40;
  return project;
}

test('a recessed lid leaves the wall\'s free edge flat at its own nominal height, with mortise holes carrying the joint instead', () => {
  const project = lidFixtureProject();
  project.lid = { enabled: true, mode: 'recessed', insertHeightMm: 20 };
  const topRun = enumerateWallRuns(project.grid, project).find((r) => r.kind === 'h' && r.r === 0);
  const piece = buildWallPiece(topRun, project.grid, project).toPiece();

  const maxY = Math.max(...piece.outline.map((p) => p.y));
  assert(Math.abs(maxY - 40) < 1e-6, `expected the free edge to stay flat at the nominal height (40), got a max y of ${maxY}`);
  assert(piece.holes.length > 0, 'expected mid-height mortise holes carrying the recessed lid\'s own joint');
});

test('an onTop lid makes the wall\'s free edge ADD fingers beyond its own nominal height, with no mortise holes at all', () => {
  const project = lidFixtureProject();
  project.lid = { enabled: true, mode: 'onTop', insertHeightMm: null };
  const topRun = enumerateWallRuns(project.grid, project).find((r) => r.kind === 'h' && r.r === 0);
  const piece = buildWallPiece(topRun, project.grid, project).toPiece();

  const maxY = Math.max(...piece.outline.map((p) => p.y));
  assert(maxY > 40 + 1e-6, `expected some tooth to protrude past the nominal height (40) to reach the onTop lid, got a max y of ${maxY}`);
  assert(piece.holes.length === 0, 'an onTop lid joints entirely through the free edge — it should never also carry mortise holes');
});

test('an onTop lid: the wall\'s topEdge finger phase exactly matches the Lid\'s own boundary phase, so a protruding tooth always lands where the Lid recedes to receive it, never where the Lid\'s own material still is', () => {
  const project = lidFixtureProject();
  project.lid = { enabled: true, mode: 'onTop', insertHeightMm: null };
  const topRun = enumerateWallRuns(project.grid, project).find((r) => r.kind === 'h' && r.r === 0);
  const wallTopSegments = buildWallPiece(topRun, project.grid, project).topEdge.segments();

  const lid = buildLid(project.grid, project);
  const lidTopSegments = lid.sides.top.edge.segments();

  assert(wallTopSegments.length === lidTopSegments.length, `expected the same comb tiling on both sides of the joint, got ${wallTopSegments.length} vs ${lidTopSegments.length} segments`);
  for (let i = 0; i < wallTopSegments.length; i++) {
    assert(wallTopSegments[i].kind === lidTopSegments[i].kind,
      `segment ${i}: wall reads '${wallTopSegments[i].kind}' but the lid reads '${lidTopSegments[i].kind}' — a mismatch here means the wall's tooth and the lid's own recess fall out of sync`);
  }
});

test('an onTop lid never forces the wall\'s own physical tip to the full protruding height regardless of its real comb phase — the tip must match whichever segment (finger or space) the tiling naturally puts there, or it overshoots past where the Lid\'s own independently-snapped corner recedes to receive it', () => {
  const project = lidFixtureProject();
  project.lid = { enabled: true, mode: 'onTop', insertHeightMm: null };
  // fingerJoint.marginMm (5mm by default) puts a leading 'flush' segment
  // right at the u=0 physical tip, before the actual comb starts (see
  // FingerJoint.fingerEdgePath) — a 'flush' segment protrudes exactly like
  // a 'space' one (baseValueAt only adds the protrusion for 'finger'), so
  // the tip must stay flush at the nominal height, never be forced up to
  // the finger height the way the now-retired "flush" case's
  // forceEndsToFinger used to.
  const topRun = enumerateWallRuns(project.grid, project).find((r) => r.kind === 'h' && r.r === 0);
  const wallPanel = buildWallPiece(topRun, project.grid, project);
  assert(wallPanel.topEdge.segments()[0].kind !== 'finger', 'sanity check: this run\'s own first comb segment should naturally be \'flush\' or \'space\', not \'finger\', for this assertion to mean anything');

  const tipValue = wallPanel.topEdge.intervalValue(0, 0, 0.001);
  assertClose(tipValue, 40, 1e-6, 'the physical tip\'s own natural phase here is \'space\' — it must stay flush at the nominal height (40), not be forced up to the finger height (43)');
});

run();
