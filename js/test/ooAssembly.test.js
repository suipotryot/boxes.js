// Assembly: orchestrates walls + base plate + lid from Grid/Project. This
// file's own end-to-end equivalence coverage (formerly ooBox.test.js/
// ooEquivalence.test.js, comparing against the old procedural pipeline)
// was retired at the step-8 cutover once that pipeline was deleted — see
// the plan. This file instead holds targeted regression tests for bugs
// found post-cutover, exercising Assembly's own exported builders
// directly.
import { test, assert, assertClose, run } from './testHarness.js';
import { createGrid, setSegmentHeight, setSegmentPresent } from '../model/Grid.js';
import { createDefaultProject } from '../state/Project.js';
import { enumerateWallRuns, heightProfile, heightAt, xAt, yAt } from '../model/GridQuery.js';
import { buildWallPiece, buildLid, buildBasePlate } from '../geometry/oo/Assembly.js';
import { SmoothEdge } from '../geometry/oo/SmoothEdge.js';
import { Notch } from '../geometry/oo/Notch.js';

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

// FlatPanel (base plate/lid) open sides: an open side (no outer wall run,
// e.g. a drawer sleeve's own openSide) used to be represented as `null` in
// buildBoundarySides — no Edge object at all, so a grip notch had nowhere
// to anchor. It should now be a real (un-toothed) SmoothEdge, exactly like
// a wall's own free/top edge, WITHOUT changing the default (no-notch)
// geometry at all.

function openRightBasePlateFixture() {
  const project = createDefaultProject();
  project.grid = createGrid([100], [80]); // single cell
  project.grid = setSegmentPresent(project.grid, 'v', 1, 0, false); // remove the right outer wall
  project.outerThicknessMm = 3;
  return project;
}

test('a base plate\'s open side (no outer wall run there) is a real SmoothEdge, not null, so a grip notch has somewhere to anchor', () => {
  const project = openRightBasePlateFixture();
  const basePlate = buildBasePlate(project.grid, project);

  assert(basePlate.sides.right !== null, 'the open right side should no longer be entirely absent');
  assert(basePlate.sides.right.edge instanceof SmoothEdge, `expected a SmoothEdge on the open side, got ${basePlate.sides.right.edge && basePlate.sides.right.edge.constructor.name}`);
  assert(basePlate.sides.top !== null && basePlate.sides.top.edge.constructor.name === 'FingerEdge', 'sanity check: the top side still has its own wall, so it should stay a FingerEdge, unaffected by this change');
});

test('a base plate\'s open side, with no notch configured, produces the exact same outline as the old null-side straight line — no accidental geometry shift', () => {
  const project = openRightBasePlateFixture();
  const piece = buildBasePlate(project.grid, project).toPiece();

  const widthMm = xAt(project.grid, project, project.grid.sx.length);
  const depthMm = yAt(project.grid, project, project.grid.sy.length);
  // Same corner formula as OuterBoundary.outerBoundaryOutline: 0 margin on
  // the open (right) side, the outer margin (outerThicknessMm) on every
  // side that still has a real wall (top/bottom/left here).
  const marginMm = project.outerThicknessMm;
  const topRightExpected = { x: widthMm, y: -marginMm };
  const bottomRightExpected = { x: widthMm, y: depthMm + marginMm };

  const maxX = Math.max(...piece.outline.map((p) => p.x));
  assertClose(maxX, widthMm, 1e-6, 'the open right side must stay flush at the nominal width, with no protruding/receding margin, exactly like the old null-side straight line');

  const nearCorner = (target) => piece.outline.some((p) => Math.abs(p.x - target.x) < 1e-6 && Math.abs(p.y - target.y) < 1e-6);
  assert(nearCorner(topRightExpected), `expected an outline point at the top-right corner ${JSON.stringify(topRightExpected)}`);
  assert(nearCorner(bottomRightExpected), `expected an outline point at the bottom-right corner ${JSON.stringify(bottomRightExpected)}`);
});

// A grip notch on a base plate's own open (smooth) edge — stored under the
// compound key `${pieceId}:${compass}` (e.g. 'base-plate:right'), since a
// flat piece can have several independent open edges, unlike a wall's
// single free/top edge.

test('a grip notch on a base plate\'s open right edge cuts INTO the panel (x decreases below the nominal width) across its own width, and leaves the rest of that edge flush', () => {
  const project = openRightBasePlateFixture();
  project.pieceNotches = { 'base-plate:right': [{ widthMm: 20, depthMm: 8, offsetMm: 30, radiusMm: 0 }] };
  const basePlate = buildBasePlate(project.grid, project);

  const widthMm = xAt(project.grid, project, project.grid.sx.length);
  // Directly on the right edge's own points() (its local u axis runs along
  // y — see buildBoundarySides' own right-side axisPoint) rather than the
  // full assembled outline, which also contains the left edge's own points
  // over the very same y range and would otherwise be ambiguous.
  const rightPoints = basePlate.sides.right.edge.points();
  const hasPoint = (u, y) => rightPoints.some((p) => Math.abs(p.u - u) < 1e-6 && Math.abs(p.y - y) < 1e-6);

  assert(hasPoint(30, 0), 'expected a flush point (y=0) right where the notch starts (the jump-in wall)');
  assert(hasPoint(30, -8), 'expected the notch\'s own near wall, read as a magnitude of depthMm (8) INTO the panel (a negative y here, per the flipped-inward convention this open-side branch uses)');
  assert(hasPoint(50, -8), 'expected the notch\'s own far wall, still cut in by depthMm (8)');
  assert(hasPoint(50, 0), 'expected a flush point (y=0) right where the notch ends (the jump-out wall)');
  for (const p of rightPoints) {
    if (p.u < 30 - 1e-6 || p.u > 50 + 1e-6) assertClose(p.y, 0, 1e-6, `point at u=${p.u}, outside the notch's own span, should stay flush`);
  }

  // And the assembled outline really does dip to widthMm-8 at those y's.
  const piece = basePlate.toPiece();
  const nearPoint = (target) => piece.outline.some((p) => Math.abs(p.x - target.x) < 1e-6 && Math.abs(p.y - target.y) < 1e-6);
  assert(nearPoint({ x: widthMm - 8, y: 30 }), `expected the outline to reach x=${widthMm - 8} at y=30 (the notch's own start)`);
  assert(nearPoint({ x: widthMm - 8, y: 50 }), `expected the outline to reach x=${widthMm - 8} at y=50 (the notch's own end)`);
  assert(nearPoint({ x: widthMm, y: 30 }) && nearPoint({ x: widthMm, y: 50 }), 'expected the flush (nominal width) points bracketing the notch on either side');
});

test('a grip notch stored for the drawer\'s own base plate open edge (prefixed key) is found via the sleeve\'s own unprefixed project, exactly like a drawer wall notch already is', () => {
  // Mirrors Drawer.sleeveContext's own unprefixing of project.pieceNotches
  // (DRAWER_PREFIX = 'drawer:') — buildBasePlate itself only ever sees the
  // bare 'base-plate' id, so a notch stored under 'drawer:base-plate:right'
  // must already be unprefixed to 'base-plate:right' by the time it reaches
  // buildBasePlate, exactly as Drawer.js already does for wall notches.
  const project = openRightBasePlateFixture();
  project.pieceNotches = { 'base-plate:right': [{ widthMm: 20, depthMm: 8, offsetMm: 30, radiusMm: 0 }] };
  const withNotch = buildBasePlate(project.grid, project).toPiece();
  const without = buildBasePlate(project.grid, { ...project, pieceNotches: {} }).toPiece();

  assert(JSON.stringify(withNotch.outline) !== JSON.stringify(without.outline), 'the notch stored under the unprefixed key should actually affect the outline');
});

run();
