// Assembly: orchestrates walls + base plate + lid from Grid/Project. This
// file's own end-to-end equivalence coverage (formerly ooBox.test.js/
// ooEquivalence.test.js, comparing against the old procedural pipeline)
// was retired at the step-8 cutover once that pipeline was deleted — see
// the plan. This file instead holds targeted regression tests for bugs
// found post-cutover, exercising Assembly's own exported builders
// directly.
import { test, assert, assertClose, run } from './testHarness.js';
import { createGrid, setSegmentHeight, setSegmentPresent } from '../model/Grid.js';
import { createDefaultProject, createM2ExampleProject } from '../state/Project.js';
import { enumerateWallRuns, heightProfile, heightAt, xAt, yAt, junctionKindAt, wallPieceId, coverageRectangle } from '../model/GridQuery.js';
import { buildWallPiece, buildLid, buildBasePlate, buildHorizontalPanel, buildFlatPiece, wallSmoothEdges, coverageHoldsFlankTabs } from '../geometry/oo/Assembly.js';
import { SmoothEdge } from '../geometry/oo/SmoothEdge.js';
import { Drawer } from '../geometry/oo/Drawer.js';
import { Box } from '../geometry/oo/Box.js';
import { isSimplePolygon } from './polygonAssertions.js';

// A divider that stops mid-span in a T-junction against another, fully
// through-going divider — its own end-comb must reach the mating wall's
// NEAR/FAR face (centerline ± half its thickness), never the centerline
// itself: GridQuery.xAt/yAt place an interior grid line's coordinate on
// the mating wall's own CENTERLINE, so a naive baseline there already
// overshoots by half the mating wall's thickness once FingerEdge adds its
// own full-thickness teeth on top (see HalfLapNotch's sibling X-crossing
// case, which does back off by /2, for contrast).

test('a divider terminating mid-span at a T junction against a fully-through inner divider gets an end comb reaching the mating wall\'s near/far FACE, not its centerline', () => {
  const project = createDefaultProject();
  project.grid = createGrid([80, 80], [80, 80]); // 2x2: interior v-divider at c=1, interior h-divider at r=1
  project.outerThicknessMm = 3;
  project.innerThicknessMm = 2;
  // remove the bottom half of the vertical divider at c=1, so it only
  // spans the top row and ends in a T junction against the full
  // horizontal divider at r=1 (still present across both c=0 and c=1).
  project.grid = setSegmentPresent(project.grid, 'v', 1, 1, false);

  const run = enumerateWallRuns(project.grid, project).find((r) => r.kind === 'v' && r.c === 1);
  assert(run.bPoint[0] === 1 && run.bPoint[1] === 1, `sanity check: this run's own end should land at the T junction (1,1), got ${JSON.stringify(run.bPoint)}`);
  assertClose(yAt(project.grid, project, 1), 81, 1e-9, 'sanity check: the mating wall\'s own centerline');

  const panel = buildWallPiece(run, project.grid, project);
  const values = panel.rightEdge.points().map((p) => p.y);
  const near = Math.min(...values);
  const far = Math.max(...values);
  assertClose(near, 80, 1e-9, 'the flush region should sit at the mating wall\'s NEAR face (centerline - thickness/2), not its centerline (81)');
  assertClose(far, 82, 1e-9, 'the finger tips should sit at the mating wall\'s FAR face (centerline + thickness/2), not centerline + full thickness (83)');
});

test('the same T-junction fix applies to a run\'s own aPoint (leftEdge), not just bPoint (rightEdge)', () => {
  const project = createDefaultProject();
  project.grid = createGrid([80, 80], [80, 80]);
  project.outerThicknessMm = 3;
  project.innerThicknessMm = 2;
  // remove the TOP half of the vertical divider at c=1 instead, so its own
  // aPoint (not bPoint) lands on the T junction against the full
  // horizontal divider at r=1.
  project.grid = setSegmentPresent(project.grid, 'v', 1, 0, false);

  const run = enumerateWallRuns(project.grid, project).find((r) => r.kind === 'v' && r.c === 1);
  assert(run.aPoint[0] === 1 && run.aPoint[1] === 1, `sanity check: this run's own start should land at the T junction (1,1), got ${JSON.stringify(run.aPoint)}`);
  const junction = junctionKindAt(project.grid, 'v', run.aPoint[0], run.aPoint[1], true);
  assert(junction.kind === 'stem' && junction.seg.thicknessGroup === 'inner', `sanity check: expected an inner-mate stem junction, got kind=${junction.kind}`);

  const panel = buildWallPiece(run, project.grid, project);
  const values = panel.leftEdge.points().map((p) => p.y);
  // leftEdge's own local frame starts at 0 (its own aPoint), signMm=-1, so
  // the NEAR face (closer to the run's own body) is the larger value here.
  assertClose(Math.max(values), 1, 1e-9, 'the flush region should sit at +protrusionA/2 (near face), not at 0 (the raw local start)');
  assertClose(Math.min(values), -1, 1e-9, 'the finger tips should sit at -protrusionA/2 (far face), not -protrusionA (2, the old overshoot)');
});

test('the T-junction fix also applies to an \'h\' run (xAt axis), symmetric to the \'v\'/yAt case above', () => {
  const project = createDefaultProject();
  project.grid = createGrid([80, 80], [80, 80]);
  project.outerThicknessMm = 3;
  project.innerThicknessMm = 2;
  // remove the right half of the horizontal divider at r=1, so it ends in
  // a T junction against the full vertical divider at c=1.
  project.grid = setSegmentPresent(project.grid, 'h', 1, 1, false);

  const run = enumerateWallRuns(project.grid, project).find((r) => r.kind === 'h' && r.r === 1);
  assert(run.bPoint[0] === 1 && run.bPoint[1] === 1, `sanity check: this run's own end should land at the T junction (1,1), got ${JSON.stringify(run.bPoint)}`);
  assertClose(xAt(project.grid, project, 1), 81, 1e-9, 'sanity check: the mating wall\'s own centerline');

  const panel = buildWallPiece(run, project.grid, project);
  const values = panel.rightEdge.points().map((p) => p.y);
  assertClose(Math.min(values), 80, 1e-9, 'the flush region should sit at the mating wall\'s NEAR face');
  assertClose(Math.max(values), 82, 1e-9, 'the finger tips should sit at the mating wall\'s FAR face');
});

test('a divider ending flush at the box\'s own OUTER wall (junctionKindAt also calls this \'stem\') must NOT get the T-junction correction — its mating wall is already on the grid boundary, where xAt/yAt contribute zero', () => {
  const project = createDefaultProject();
  project.grid = createGrid([80, 80], [80, 80]); // full-height divider at c=1, untouched
  project.outerThicknessMm = 3;
  project.innerThicknessMm = 2;

  const run = enumerateWallRuns(project.grid, project).find((r) => r.kind === 'v' && r.c === 1);
  assert(run.bPoint[0] === 1 && run.bPoint[1] === 2, `sanity check: expected the full-height run to end at the box's own bottom wall, got ${JSON.stringify(run.bPoint)}`);
  const junction = junctionKindAt(project.grid, 'v', run.bPoint[0], run.bPoint[1], true);
  assert(junction.kind === 'stem' && junction.seg.thicknessGroup === 'outer', `sanity check: expected an outer-mate stem junction, got kind=${junction.kind}, group=${junction.seg && junction.seg.thicknessGroup}`);

  const panel = buildWallPiece(run, project.grid, project);
  const values = panel.rightEdge.points().map((p) => p.y);
  assertClose(Math.min(values), run.length, 1e-9, 'the flush region must stay at the raw run.length — no correction for an outer mate');
  assertClose(Math.max(values), run.length + project.outerThicknessMm, 1e-9, 'the finger tips must reach run.length + the FULL outer thickness — no correction for an outer mate');
});

test('a real box outer corner (both perpendicular pieces also terminate there — junctionKindAt classifies it \'corner\') keeps its uncorrected end-comb baseline, untouched by the T-junction fix', () => {
  const project = createDefaultProject();
  project.grid = createGrid([100], [80]); // single cell
  project.outerThicknessMm = 3;

  const run = enumerateWallRuns(project.grid, project).find((r) => r.kind === 'h' && r.r === 0);
  const junction = junctionKindAt(project.grid, 'h', run.aPoint[0], run.aPoint[1], true);
  assert(junction.kind === 'corner', `sanity check: expected a real box corner, got kind=${junction.kind}`);

  const panel = buildWallPiece(run, project.grid, project);
  const values = panel.leftEdge.points().map((p) => p.y);
  assertClose(Math.min(values), 0, 1e-9, 'the flush region must stay at the raw baseline (0) — corners are never touched by the T-junction fix');
  assertClose(Math.max(values), project.outerThicknessMm, 1e-9, 'the finger tips must reach the FULL outer thickness — corners are never touched by the T-junction fix');
});

// Follow-up fix: the T-junction correction above only touched
// rightEdge/leftEdge, leaving bottomEdge/topEdge ending at the raw,
// uncorrected run.length — creating a tiny step at the corner where they
// meet (invisible on the raw outline, but BurnCorrection.outwardNormal's
// unweighted direction-averaging blows it up into a visible diagonal
// spike). bottomEdge/topEdge must now recede to the SAME corrected corner.

test('bottomEdge/topEdge now recede to match rightEdge/leftEdge\'s own T-junction-corrected corner — the user\'s own real reproduction of the corner-step defect', () => {
  const project = createDefaultProject();
  project.grid = createGrid([20, 20], [20, 20]);
  project.outerThicknessMm = 3;
  project.innerThicknessMm = 3;
  project.fingerJoint = { fingerMm: 5, spaceMm: 5, marginMm: 2, playMm: 0.1 };
  // remove the right half of the horizontal divider at r=1, so it ends in
  // a T junction against the full vertical divider at c=1.
  project.grid = setSegmentPresent(project.grid, 'h', 1, 1, false);

  const run = enumerateWallRuns(project.grid, project).find((r) => r.kind === 'h' && r.r === 1);
  assert(run.bPoint[0] === 1 && run.bPoint[1] === 1, `sanity check: expected the T junction at (1,1), got ${JSON.stringify(run.bPoint)}`);
  const junction = junctionKindAt(project.grid, 'h', run.bPoint[0], run.bPoint[1], true);
  assert(junction.kind === 'stem' && junction.seg.thicknessGroup === 'inner', 'sanity check: expected the inner-mate stem case the previous fix targets');

  const panel = buildWallPiece(run, project.grid, project);
  const correction = project.innerThicknessMm / 2; // 1.5 — matches rightEdge's own already-fixed correction

  const bottomPts = panel.bottomEdge.points();
  const bottomLast = bottomPts.reduce((a, b) => (b.u > a.u ? b : a));
  assertClose(bottomLast.u, run.length - correction, 1e-9, 'bottomEdge\'s own last point must recede to the corrected corner, not stay at the raw run.length');

  const topPts = panel.topEdge.points();
  const topLast = topPts.reduce((a, b) => (b.u > a.u ? b : a));
  assertClose(topLast.u, run.length - correction, 1e-9, 'topEdge\'s own last point must recede the same way');

  // The actual visual defect surface: bottomEdge's/topEdge's own corner
  // point must exactly match rightEdge's own value there — no gap/step.
  const rightPts = panel.rightEdge.points();
  const rightNear = rightPts.reduce((a, b) => (b.u < a.u ? b : a)); // u=0, meets bottomEdge
  const rightFar = rightPts.reduce((a, b) => (b.u > a.u ? b : a)); // u=height, meets topEdge
  assertClose(bottomLast.u, rightNear.y, 1e-9, 'bottomEdge\'s corner must land exactly on rightEdge\'s own near-face value — no step');
  assertClose(topLast.u, rightFar.y, 1e-9, 'topEdge\'s corner must land exactly on rightEdge\'s own value at its own top — no step');
});

test('when the T-junction correction would exceed the guaranteed flush margin, bottomEdge\'s own corner clip is capped rather than cutting into a real tooth', () => {
  const project = createDefaultProject();
  project.grid = createGrid([20, 20], [20, 20]);
  project.outerThicknessMm = 3;
  project.innerThicknessMm = 20; // correction (10) would dwarf a small margin
  project.fingerJoint = { fingerMm: 5, spaceMm: 5, marginMm: 2, playMm: 0.1 };
  project.grid = setSegmentPresent(project.grid, 'h', 1, 1, false);

  const run = enumerateWallRuns(project.grid, project).find((r) => r.kind === 'h' && r.r === 1);
  const panel = buildWallPiece(run, project.grid, project);
  const rawCorrection = project.innerThicknessMm / 2; // 10

  const bottomPts = panel.bottomEdge.points();
  const bottomLast = bottomPts.reduce((a, b) => (b.u > a.u ? b : a));
  const actualClip = run.length - bottomLast.u;
  assert(actualClip < rawCorrection, `expected the clip (${actualClip}) to be capped below the raw correction (${rawCorrection})`);
  assert(actualClip > 0, 'the clip should still be nonzero (some recession), not silently dropped entirely');

  // No point of bottomEdge should land inside a real tooth's own interior
  // — every point must sit at a 'flush'/margin value the tiling itself
  // already guarantees, never a half-cut tooth.
  const segs = panel.bottomEdge.segments();
  const clippedZoneStart = bottomLast.u;
  for (const seg of segs) {
    if (seg.kind !== 'finger') continue;
    const segEnd = seg.start + seg.length;
    assert(segEnd <= clippedZoneStart + 1e-9, `a real tooth (u=${seg.start}..${segEnd}) must not be sliced by the clip boundary at u=${clippedZoneStart}`);
  }
});

test('a grip notch anchored flush against a T-junction-corrected corner disables the clip at that end rather than producing a malformed shape', () => {
  const project = createDefaultProject();
  project.grid = createGrid([20, 20], [20, 20]);
  project.outerThicknessMm = 3;
  project.innerThicknessMm = 3;
  project.fingerJoint = { fingerMm: 5, spaceMm: 5, marginMm: 2, playMm: 0.1 };
  project.grid = setSegmentPresent(project.grid, 'h', 1, 1, false);

  const run = enumerateWallRuns(project.grid, project).find((r) => r.kind === 'h' && r.r === 1);
  const pieceId = `wall-${run.kind}-${run.aPoint[0]}-${run.aPoint[1]}`;
  // A grip notch on the free/top edge, anchored flush against the very
  // corner this fix recedes (offsetMm+widthMm === run.length) — explicitly
  // permitted by NotchValidation.js.
  project.pieceNotches = { [pieceId]: [{ widthMm: 5, depthMm: 2, offsetMm: run.length - 5, radiusMm: 0 }] };

  const panel = buildWallPiece(run, project.grid, project);
  const topPts = panel.topEdge.points();
  const topLast = topPts.reduce((a, b) => (b.u > a.u ? b : a));
  assertClose(topLast.u, run.length, 1e-9, 'the clip must be disabled at this end (falls back to the raw run.length) since a fragment straddles it');
  assert(topPts.some((p) => Math.abs(p.u - (run.length - 5)) < 1e-9), 'the notch fragment itself must still render, untouched');
});

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


function lidFixtureProject() {
  const project = createDefaultProject();
  project.grid = createGrid([100], [100]); // single cell: no interior dividers to complicate the boundary
  project.outerThicknessMm = 3;
  project.outerHeightMm = 40;
  return project;
}

function panelFixtureProject(coverage = null) {
  const project = lidFixtureProject();
  project.horizontalPanels = [{ id: 'horizontal-panel-1', heightMm: 20, coverage }];
  return project;
}

function onlyPanelOf(project) {
  return buildHorizontalPanel(project.grid, project, project.horizontalPanels[0]);
}

test('buildWallPiece() should leave the free edge flat at its nominal height when a horizontal panel is set, with mortises carrying the joint instead', () => {
  const project = panelFixtureProject();
  const topRun = enumerateWallRuns(project.grid, project).find((r) => r.kind === 'h' && r.r === 0);
  const piece = buildWallPiece(topRun, project.grid, project).toPiece();

  const maxY = Math.max(...piece.outline.map((p) => p.y));
  assert(Math.abs(maxY - 40) < 1e-6, `expected the free edge to stay flat at the nominal height (40), got a max y of ${maxY}`);
  assert(piece.holes.length > 0, 'expected mid-height mortise holes carrying the horizontal panel joint');
});

test('buildWallPiece() should make the free edge ADD fingers beyond its nominal height under the lid, with no mortise holes at all', () => {
  const project = lidFixtureProject();
  project.lid = { enabled: true };
  const topRun = enumerateWallRuns(project.grid, project).find((r) => r.kind === 'h' && r.r === 0);
  const piece = buildWallPiece(topRun, project.grid, project).toPiece();

  const maxY = Math.max(...piece.outline.map((p) => p.y));
  assert(maxY > 40 + 1e-6, `expected some tooth to protrude past the nominal height (40) to reach the onTop lid, got a max y of ${maxY}`);
  assert(piece.holes.length === 0, 'an onTop lid joints entirely through the free edge — it should never also carry mortise holes');
});

test('buildWallPiece() should match the lid boundary phase with its topEdge finger phase the Lid\'s own boundary phase, so a protruding tooth always lands where the Lid recedes to receive it, never where the Lid\'s own material still is', () => {
  const project = lidFixtureProject();
  project.lid = { enabled: true };
  const topRun = enumerateWallRuns(project.grid, project).find((r) => r.kind === 'h' && r.r === 0);
  const wallTopSegments = buildWallPiece(topRun, project.grid, project).topEdge.segments();

  const lid = buildLid(project.grid, project);
  // lid's own compass-top (north) side lives in the `bottomEdge` field, not
  // `topEdge` — see FlatPanel.js's own COMPASS_TO_FIELD comment: a flat
  // piece's north side occupies the SAME assembly position as a wall's own
  // socle edge. This is intentional, not a bug — do not "fix" it to lid.topEdge.
  const lidTopSegments = lid.bottomEdge.segments();

  assert(wallTopSegments.length === lidTopSegments.length, `expected the same comb tiling on both sides of the joint, got ${wallTopSegments.length} vs ${lidTopSegments.length} segments`);
  for (let i = 0; i < wallTopSegments.length; i++) {
    assert(wallTopSegments[i].kind === lidTopSegments[i].kind,
      `segment ${i}: wall reads '${wallTopSegments[i].kind}' but the lid reads '${lidTopSegments[i].kind}' — a mismatch here means the wall's tooth and the lid's own recess fall out of sync`);
  }
});

test('buildWallPiece() should never force the wall\'s own physical tip under the lid to the full protruding height regardless of its real comb phase — the tip must match whichever segment (finger or space) the tiling naturally puts there, or it overshoots past where the Lid\'s own independently-snapped corner recedes to receive it', () => {
  const project = lidFixtureProject();
  project.lid = { enabled: true };
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

test('buildBasePlate() should give a recessed base plate the exact outline of a full horizontal panel — tabs reaching out through the outer walls', () => {
  const project = panelFixtureProject();
  project.basePlate = { mode: 'recessed', recessMm: 3 };
  const plate = buildBasePlate(project.grid, project).toPiece();
  const panel = onlyPanelOf(project).toPiece();
  assert(JSON.stringify(plate.outline) === JSON.stringify(panel.outline));
});

function recessedBasePlateFixtureProject() {
  const project = lidFixtureProject();
  project.basePlate = { mode: 'recessed', recessMm: 5 };
  return project;
}

function outerTopRun(project) {
  return enumerateWallRuns(project.grid, project).find((r) => r.kind === 'h' && r.r === 0);
}

test('buildWallPiece() should extend an outer wall down to the recess below the base plate, with a flat bottom edge', () => {
  const project = recessedBasePlateFixtureProject();
  const piece = buildWallPiece(outerTopRun(project), project.grid, project).toPiece();
  const minY = Math.min(...piece.outline.map((p) => p.y));
  assertClose(minY, -8, 1e-9, 'outerThicknessMm (3) + recessMm (5) below v=0');
  const bottomPoints = piece.outline.filter((p) => Math.abs(p.y - minY) < 1e-9);
  assert(bottomPoints.length === 2, `a flat bottom edge is a single segment, got ${bottomPoints.length} points at the lowest y`);
});

function intervalsAtY(outline, y) {
  const xs = outline.filter((p) => Math.abs(p.y - y) < 1e-9).map((p) => p.x).sort((a, b) => a - b);
  const intervals = [];
  for (let i = 0; i < xs.length; i += 2) intervals.push([xs[i], xs[i + 1]]);
  return intervals;
}

test('buildWallPiece() should cut one mortise hole through the outer wall for each base plate tab, at the exact same position', () => {
  const project = recessedBasePlateFixtureProject();
  const plateTabs = intervalsAtY(buildBasePlate(project.grid, project).toPiece().outline, -3);
  const holes = buildWallPiece(outerTopRun(project), project.grid, project).toPiece().holes;

  assert(plateTabs.length > 0, 'sanity check: the recessed base plate should have tabs on its top side');
  assert(holes.length === plateTabs.length, `expected ${plateTabs.length} holes, got ${holes.length}`);
  holes.forEach((hole, i) => {
    const xs = hole.map((p) => p.x), ys = hole.map((p) => p.y);
    assertClose(Math.min(...xs), plateTabs[i][0], 1e-9, `hole ${i} start`);
    assertClose(Math.max(...xs), plateTabs[i][1], 1e-9, `hole ${i} end`);
    assertClose(Math.min(...ys), -3, 1e-9, `hole ${i} should reach the base plate's bottom face`);
    assertClose(Math.max(...ys), 0, 1e-9, `hole ${i} should reach the base plate's top face`);
  });
});

test('buildWallPiece() should also match the base plate tabs on a vertical outer wall, whose tiling runs along the plate y axis', () => {
  const project = recessedBasePlateFixtureProject();
  const transposed = buildBasePlate(project.grid, project).toPiece().outline.map((p) => ({ x: p.y, y: p.x }));
  const plateTabs = intervalsAtY(transposed, -3);
  const leftRun = enumerateWallRuns(project.grid, project).find((r) => r.kind === 'v' && r.c === 0);
  const holes = buildWallPiece(leftRun, project.grid, project).toPiece().holes;

  assert(holes.length === plateTabs.length && holes.length > 0, `expected ${plateTabs.length} holes, got ${holes.length}`);
  holes.forEach((hole, i) => {
    assertClose(Math.min(...hole.map((p) => p.x)), plateTabs[i][0], 1e-9, `hole ${i} start`);
    assertClose(Math.max(...hole.map((p) => p.x)), plateTabs[i][1], 1e-9, `hole ${i} end`);
  });
});

function fingerRanges(edge) {
  return edge.segments().filter((s) => s.kind === 'finger').map((s) => [edge.startsAtMm + s.start, edge.startsAtMm + s.start + s.length]);
}

test('buildWallPiece() should keep the two outer walls meeting at a corner complementary over their whole extended height', () => {
  const project = recessedBasePlateFixtureProject();
  project.fingerJoint = { ...project.fingerJoint, playMm: 0 };
  const runs = enumerateWallRuns(project.grid, project);
  const topWall = buildWallPiece(runs.find((r) => r.kind === 'h' && r.r === 0), project.grid, project);
  const leftWall = buildWallPiece(runs.find((r) => r.kind === 'v' && r.c === 0), project.grid, project);
  const ranges = [...fingerRanges(topWall.leftEdge), ...fingerRanges(leftWall.leftEdge)].sort((a, b) => a[0] - b[0]);

  assertClose(ranges[0][0], -8, 1e-9, 'the corner comb should start at the wall bottom');
  assertClose(ranges[ranges.length - 1][1], 40, 1e-9, 'the corner comb should end at the wall top');
  for (let i = 1; i < ranges.length; i++) {
    assertClose(ranges[i][0], ranges[i - 1][1], 1e-9, `the two combs should neither overlap nor leave a gap at range ${i}`);
  }
});

test('buildWallPiece() should leave interior dividers untouched by a recessed base plate', () => {
  const flush = createDefaultProject();
  flush.grid = createGrid([90, 130], [70, 100]);
  const recessed = { ...flush, basePlate: { mode: 'recessed', recessMm: 5 } };
  const dividerRuns = enumerateWallRuns(flush.grid, flush).filter((r) => r.seg.thicknessGroup === 'inner');

  assert(dividerRuns.length > 0, 'sanity check: the 2x2 grid should have interior dividers');
  for (const run of dividerRuns) {
    const before = buildWallPiece(run, flush.grid, flush).toPiece();
    const after = buildWallPiece(run, recessed.grid, recessed).toPiece();
    assert(JSON.stringify(before) === JSON.stringify(after), `divider ${before.id} changed`);
  }
});

function tabsAlongOuterRun(plateOutline, run, outerThicknessMm) {
  const alongX = run.kind === 'h';
  const outline = alongX ? plateOutline : plateOutline.map((p) => ({ x: p.y, y: p.x }));
  const atFarSide = alongX ? run.r !== 0 : run.c !== 0;
  const faceY = atFarSide ? Math.max(...outline.map((p) => p.y)) : -outerThicknessMm;
  return intervalsAtY(outline, faceY);
}

function basePlateHolesOf(wallPiece) {
  return wallPiece.holes
    .filter((hole) => Math.max(...hole.map((p) => p.y)) <= 1e-9)
    .map((hole) => [Math.min(...hole.map((p) => p.x)), Math.max(...hole.map((p) => p.x))])
    .sort((a, b) => a[0] - b[0]);
}

test('Box.fromProject() should build a recessed 2x2 box whose every base plate tab meets a mortise hole, with every piece still cuttable', () => {
  const project = createM2ExampleProject();
  project.basePlate = { mode: 'recessed', recessMm: 5 };
  const box = Box.fromProject(project);

  for (const piece of box.allPiecesBurnCorrected()) {
    assert(isSimplePolygon(piece.outline), `${piece.id}: outline should stay a simple polygon after burn correction`);
    piece.holes.forEach((hole, i) => assert(isSimplePolygon(hole), `${piece.id}: hole ${i} should stay a simple polygon`));
  }

  const pieces = box.allPieces();
  const plateOutline = pieces.find((p) => p.id === 'base-plate').outline;
  const outerRuns = enumerateWallRuns(project.grid, project).filter((r) => r.seg.thicknessGroup === 'outer');
  assert(outerRuns.length === 4, `sanity check: expected 4 outer walls, got ${outerRuns.length}`);
  for (const run of outerRuns) {
    const wall = pieces.find((p) => p.id === wallPieceId(run));
    const tabs = tabsAlongOuterRun(plateOutline, run, project.outerThicknessMm);
    const holes = basePlateHolesOf(wall);
    assert(tabs.length > 0 && holes.length === tabs.length, `${wall.id}: expected ${tabs.length} holes, got ${holes.length}`);
    holes.forEach((hole, i) => {
      assertClose(hole[0], tabs[i][0], 1e-9, `${wall.id}: hole ${i} start`);
      assertClose(hole[1], tabs[i][1], 1e-9, `${wall.id}: hole ${i} end`);
    });
  }
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

  // compass "right" -> FlatPanel's own `rightEdge` field (no inversion
  // there, unlike top/bottom -> bottomEdge/topEdge — see FlatPanel.js's own
  // COMPASS_TO_FIELD comment).
  assert(basePlate.rightEdge != null, 'the open right side should no longer be entirely absent');
  assert(basePlate.rightEdge instanceof SmoothEdge, `expected a SmoothEdge on the open side, got ${basePlate.rightEdge && basePlate.rightEdge.constructor.name}`);
  assert(basePlate.openSides.right === true, 'sanity check: the open-side flag must be set explicitly, never derived from the edge alone');
  // compass "top" (the side that still has its own wall here) -> FlatPanel's
  // own `bottomEdge` field, not `topEdge` — intentional inversion, see above.
  assert(basePlate.bottomEdge != null && basePlate.bottomEdge.constructor.name === 'FingerEdge', 'sanity check: the top side still has its own wall, so it should stay a FingerEdge, unaffected by this change');
});

test('D1 lock: a base plate with ONLY its own compass-north wall present populates bottomEdge (never topEdge) — this is intentional, not a bug, do not "fix" it', () => {
  const project = createDefaultProject();
  project.grid = createGrid([100], [80]); // single cell
  project.outerThicknessMm = 3;
  project.grid = setSegmentPresent(project.grid, 'v', 0, 0, false); // remove west (left)
  project.grid = setSegmentPresent(project.grid, 'v', 1, 0, false); // remove east (right)
  project.grid = setSegmentPresent(project.grid, 'h', 0, 1, false); // remove south (bottom)
  // Only the north (compass-top) wall run is left present.

  const basePlate = buildBasePlate(project.grid, project);
  assert(basePlate.bottomEdge.constructor.name === 'FingerEdge', 'the only real wall run (north) must land in bottomEdge, per FlatPanel.js\'s own COMPASS_TO_FIELD table');
  assert(basePlate.topEdge instanceof SmoothEdge, 'topEdge (compass-south) has no wall run here, so it must be the open-side SmoothEdge, not the real one');
  assert(basePlate.openSides.top === false && basePlate.openSides.bottom === true, 'openSides must track the REAL compass side, unaffected by the field-name inversion');
});

test('a base plate\'s open side, with no notch configured, produces the exact same outline as the old null-side straight line — no accidental geometry shift', () => {
  const project = openRightBasePlateFixture();
  const piece = buildBasePlate(project.grid, project).toPiece();

  const widthMm = xAt(project.grid, project, project.grid.sx.length);
  const depthMm = yAt(project.grid, project, project.grid.sy.length);
  // Same corner formula as FlatPanel.outline(): 0 margin on
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
  // y — see FlatPanel.outline()'s own right-side axisPoint) rather than the
  // full assembled outline, which also contains the left edge's own points
  // over the very same y range and would otherwise be ambiguous.
  const rightPoints = basePlate.rightEdge.points();
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

test('Drawer.sleeveContext() should keep the sleeve base plate flush even when the box base plate is recessed', () => {
  const project = recessedBasePlateFixtureProject();
  project.drawer = { enabled: true, playMm: 1, thicknessMm: 3, openSide: 'top' };
  const { project: sleeveProject } = Drawer.sleeveContext({ grid: project.grid, project });
  assert(sleeveProject.basePlate.mode === 'flush', `expected a flush sleeve base plate, got ${sleeveProject.basePlate.mode}`);
});

test('Drawer.sleeveContext() should give the sleeve the images stored under the drawer prefix, and only those', () => {
  const project = recessedBasePlateFixtureProject();
  project.drawer = { enabled: true, playMm: 1, thicknessMm: 3, openSide: 'top' };
  const image = [{ xMm: 1, yMm: 2, widthMm: 3, heightMm: 4, svg: '<svg/>' }];
  project.pieceImages = { 'base-plate': image, 'drawer:base-plate': image };
  const { project: sleeveProject } = Drawer.sleeveContext({ grid: project.grid, project });
  assert(JSON.stringify(Object.keys(sleeveProject.pieceImages)) === JSON.stringify(['base-plate']), `got ${JSON.stringify(Object.keys(sleeveProject.pieceImages))}`);
});

test('Drawer.sleeveContext() should make the sleeve taller by the box base plate recess, so the box still fits inside', () => {
  const project = recessedBasePlateFixtureProject();
  project.drawer = { enabled: true, playMm: 1, thicknessMm: 3, openSide: 'top' };
  const flushProject = { ...project, basePlate: { mode: 'flush', recessMm: null } };
  const recessedHeight = Drawer.sleeveContext({ grid: project.grid, project }).project.outerHeightMm;
  const flushHeight = Drawer.sleeveContext({ grid: project.grid, project: flushProject }).project.outerHeightMm;
  assertClose(recessedHeight - flushHeight, 5, 1e-9);
});

test('buildWallPiece() should cut one row of panel mortises per horizontal panel, each at its own height', () => {
  const project = panelFixtureProject();
  const singleRow = wallOnSide(project, 'top').holes;
  project.horizontalPanels = [
    { id: 'horizontal-panel-1', heightMm: 10, coverage: null },
    { id: 'horizontal-panel-2', heightMm: 25, coverage: null },
  ];
  const holes = wallOnSide(project, 'top').holes;
  const rowAt = (heightMm) => holes.filter((h) => Math.abs(h.yMm - heightMm) < 1e-6);
  assert(rowAt(10).length === singleRow.length && rowAt(25).length === singleRow.length, `expected two rows of ${singleRow.length} mortises at 10 and 25, got ${JSON.stringify(holes.map((h) => h.yMm))}`);
  assert(holes.length === 2 * singleRow.length, `expected nothing but those two rows, got ${holes.length} mortises`);
});

test('buildWallPiece() should cut no mortise for a horizontal panel whose height is not set yet', () => {
  const project = panelFixtureProject();
  project.horizontalPanels = [{ id: 'horizontal-panel-1', heightMm: null, coverage: null }];
  const holes = wallOnSide(project, 'top').holes;
  assert(holes.length === 0, `expected no mortise, got ${JSON.stringify(holes.map((h) => [h.xMm, h.yMm]))}`);
});

test('Box.fromProject() should build one piece per horizontal panel that has a height, skipping one whose height is not set yet', () => {
  const project = panelFixtureProject();
  project.horizontalPanels = [
    { id: 'horizontal-panel-1', heightMm: 10, coverage: null },
    { id: 'horizontal-panel-2', heightMm: null, coverage: null },
    { id: 'horizontal-panel-3', heightMm: 25, coverage: { side: 'left', depthMm: 30 } },
  ];
  const panelIds = Box.fromProject(project).allPieces().filter((piece) => piece.kind === 'horizontalPanel').map((piece) => piece.id);
  assert(JSON.stringify(panelIds) === JSON.stringify(['horizontal-panel-1', 'horizontal-panel-3']), `got ${JSON.stringify(panelIds)}`);
});

test('buildFlatPiece() should rebuild any flat piece from its id: base plate, lid or horizontal panel', () => {
  const project = panelFixtureProject();
  project.lid = { enabled: true };
  const ids = ['base-plate', 'lid', 'horizontal-panel-1'].map((id) => buildFlatPiece(project.grid, project, id).id);
  assert(JSON.stringify(ids) === JSON.stringify(['base-plate', 'lid', 'horizontal-panel-1']), `got ${JSON.stringify(ids)}`);
});

test('buildFlatPiece() should throw on an id that is not a flat piece of the project, instead of building the wrong one', () => {
  const project = panelFixtureProject();
  let thrown = null;
  try { buildFlatPiece(project.grid, project, 'horizontal-panel-2'); } catch (err) { thrown = err; }
  assert(thrown && /horizontal-panel-2/.test(thrown.message), `expected an error naming the unknown id, got ${thrown}`);
});

test('buildFlatPiece() should throw on the lid while it is disabled, instead of returning nothing to build', () => {
  const project = panelFixtureProject();
  let thrown = null;
  try { buildFlatPiece(project.grid, project, 'lid'); } catch (err) { thrown = err; }
  assert(thrown && /lid/.test(thrown.message), `expected an error about the lid, got ${thrown}`);
});

test('Box.fromProject() should keep the horizontal panels inside the box, giving the drawer sleeve none of them', () => {
  const project = panelFixtureProject();
  project.drawer = { enabled: true, playMm: 1, thicknessMm: 3, openSide: 'top' };
  const sleevePieces = Box.fromProject(project).drawer.allPieces();
  const sleevePanels = sleevePieces.filter((piece) => piece.kind === 'horizontalPanel');
  const sleeveWallHoles = sleevePieces.filter((piece) => piece.kind === 'wall').flatMap((piece) => piece.holes);
  assert(sleevePanels.length === 0, `expected no sleeve panel, got ${sleevePanels.map((piece) => piece.id)}`);
  assert(sleeveWallHoles.length === 0, `expected no panel mortise on the sleeve walls, got ${sleeveWallHoles.length}`);
});

// wallSmoothEdges: which of a wall's own edges are genuinely un-jointed —
// the wall's own free/top edge (isFreeEdge:true, unless an onTop lid joints
// it), OR an END edge whose corner has no perpendicular mate (only
// reachable via a Drawer's own openSide, since a plain box's editor never
// lets an outer wall go missing). At most one per wall in every reachable
// case: a drawer's own sleeve lid is ALWAYS onTop, so its own walls' free
// edge is NEVER smooth there — only an end edge can be, and only for the
// wall(s) adjacent to the missing side.

test('wallSmoothEdges: an ordinary wall (no lid) reports its own free top edge, isFreeEdge:true', () => {
  const project = createDefaultProject();
  project.grid = createGrid([100], [80]);
  const run = enumerateWallRuns(project.grid, project).find((r) => r.kind === 'h' && r.r === 0);

  const edges = wallSmoothEdges(run, project.grid, project);
  assert(edges.length === 1, `expected exactly one smooth edge, got ${edges.length}`);
  assert(edges[0].compass === 'top' && edges[0].isFreeEdge === true, 'expected the free/top edge, flagged isFreeEdge');
});

test('wallSmoothEdges() should report NO smooth edge for an ordinary wall under the lid at all (its top is jointed to the lid, its ends are jointed to their neighbors)', () => {
  const project = createDefaultProject();
  project.grid = createGrid([100], [80]);
  project.lid = { enabled: true };
  const run = enumerateWallRuns(project.grid, project).find((r) => r.kind === 'h' && r.r === 0);

  assert(wallSmoothEdges(run, project.grid, project).length === 0, 'every edge is jointed here — there should be nowhere to put a grip notch');
});

test('wallSmoothEdges: a drawer wall adjacent to the open side reports its own END edge (not "top", which is jointed to the sleeve\'s always-onTop lid)', () => {
  const project = createDefaultProject();
  project.grid = createGrid([100], [80]);
  project.drawer = { enabled: true, playMm: 1, thicknessMm: 3, openSide: 'right' };
  const { grid, project: sleeveProject } = Drawer.sleeveContext({ grid: project.grid, project });
  const run = enumerateWallRuns(grid, sleeveProject).find((r) => r.kind === 'h' && r.r === 0); // the sleeve's own top wall

  const edges = wallSmoothEdges(run, grid, sleeveProject);
  assert(edges.length === 1, `expected exactly one smooth edge, got ${edges.length}`);
  assert(edges[0].compass === 'right' && edges[0].isFreeEdge === false, `expected the right END edge, got ${JSON.stringify(edges[0])}`);
});

test('wallSmoothEdges: a drawer wall NOT adjacent to the open side (fully enclosed) has NO smooth edge at all', () => {
  const project = createDefaultProject();
  project.grid = createGrid([100], [80]);
  project.drawer = { enabled: true, playMm: 1, thicknessMm: 3, openSide: 'right' };
  const { grid, project: sleeveProject } = Drawer.sleeveContext({ grid: project.grid, project });
  const run = enumerateWallRuns(grid, sleeveProject).find((r) => r.kind === 'v' && r.c === 0); // the sleeve's own left wall, opposite the opening

  assert(wallSmoothEdges(run, grid, sleeveProject).length === 0, 'this wall is jointed on every side — there should be nowhere to put a grip notch');
});

test('wallSmoothEdges: a \'v\' run\'s own END-edge compass follows north/south (top/bottom), not the internal left/right naming', () => {
  const project = createDefaultProject();
  project.grid = createGrid([100], [80]);
  project.drawer = { enabled: true, playMm: 1, thicknessMm: 3, openSide: 'top' }; // now a 'v' run wall sits adjacent to the opening
  const { grid, project: sleeveProject } = Drawer.sleeveContext({ grid: project.grid, project });
  const run = enumerateWallRuns(grid, sleeveProject).find((r) => r.kind === 'v' && r.c === 0); // the sleeve's own left wall, its own TOP end now open

  const edges = wallSmoothEdges(run, grid, sleeveProject);
  assert(edges.length === 1, `expected exactly one smooth edge, got ${edges.length}`);
  assert(edges[0].compass === 'top', `expected the compass label 'top' (not the internal 'left'/'right' naming) for a 'v' run's own north end, got '${edges[0].compass}'`);
});

// Grip notches routed to a wall's own END edge (right or left, via the
// compound `${pieceId}:${compass}` key) — verified against the actual
// outline, not just derived, exactly like the base-plate/lid work above.

function drawerWallFixture(openSide) {
  const project = createDefaultProject();
  project.grid = createGrid([100], [80]);
  project.outerHeightMm = 40;
  project.drawer = { enabled: true, playMm: 1, thicknessMm: 3, openSide };
  const { grid, project: sleeveProject } = Drawer.sleeveContext({ grid: project.grid, project });
  return { grid, project: sleeveProject };
}

test('a grip notch on a drawer wall\'s own RIGHT end edge cuts INTO the wall (x decreases from the nominal length) across its own width, leaving the rest of that edge flush', () => {
  const { grid, project } = drawerWallFixture('right');
  const run = enumerateWallRuns(grid, project).find((r) => r.kind === 'h' && r.r === 0); // the sleeve's own top wall, its own right end open
  const pieceId = `wall-${run.kind}-${run.aPoint[0]}-${run.aPoint[1]}`;
  project.pieceNotches = { [`${pieceId}:right`]: [{ widthMm: 10, depthMm: 6, offsetMm: 5, radiusMm: 0 }] };

  const panel = buildWallPiece(run, grid, project);
  const rightPoints = panel.rightEdge.points();
  const hasPoint = (u, y) => rightPoints.some((p) => Math.abs(p.u - u) < 1e-6 && Math.abs(p.y - y) < 1e-6);

  assert(hasPoint(5, run.length), 'expected a flush point right where the notch starts');
  assert(hasPoint(5, run.length - 6), 'expected the notch\'s own near wall, cut 6mm (depthMm) into the wall from its right end');
  assert(hasPoint(15, run.length - 6), 'expected the notch\'s own far wall, still cut in');
  assert(hasPoint(15, run.length), 'expected a flush point right where the notch ends');
  for (const p of rightPoints) {
    if (p.u < 5 - 1e-6 || p.u > 15 + 1e-6) assertClose(p.y, run.length, 1e-6, `point at u=${p.u}, outside the notch's own span, should stay flush at the nominal length`);
  }
});

test('a grip notch on a drawer wall\'s own LEFT end edge cuts INTO the wall (x increases from 0) across its own width, leaving the rest of that edge flush', () => {
  const { grid, project } = drawerWallFixture('left');
  const run = enumerateWallRuns(grid, project).find((r) => r.kind === 'h' && r.r === 0); // the sleeve's own top wall, its own left end open
  const pieceId = `wall-${run.kind}-${run.aPoint[0]}-${run.aPoint[1]}`;
  project.pieceNotches = { [`${pieceId}:left`]: [{ widthMm: 10, depthMm: 6, offsetMm: 5, radiusMm: 0 }] };

  const panel = buildWallPiece(run, grid, project);
  const leftPoints = panel.leftEdge.points();
  const hasPoint = (u, y) => leftPoints.some((p) => Math.abs(p.u - u) < 1e-6 && Math.abs(p.y - y) < 1e-6);

  assert(hasPoint(5, 0), 'expected a flush point right where the notch starts');
  assert(hasPoint(5, 6), 'expected the notch\'s own near wall, cut 6mm (depthMm) into the wall from its left end');
  assert(hasPoint(15, 6), 'expected the notch\'s own far wall, still cut in');
  assert(hasPoint(15, 0), 'expected a flush point right where the notch ends');
  for (const p of leftPoints) {
    if (p.u < 5 - 1e-6 || p.u > 15 + 1e-6) assertClose(p.y, 0, 1e-6, `point at u=${p.u}, outside the notch's own span, should stay flush at 0`);
  }
});

test('a grip notch stored under the plain pieceId key no longer applies to a drawer wall\'s topEdge (always jointed to the sleeve\'s own onTop lid there) — it must not carve into the teeth', () => {
  const { grid, project } = drawerWallFixture('right');
  const run = enumerateWallRuns(grid, project).find((r) => r.kind === 'h' && r.r === 0);
  const pieceId = `wall-${run.kind}-${run.aPoint[0]}-${run.aPoint[1]}`;
  project.pieceNotches = { [pieceId]: [{ widthMm: 10, depthMm: 6, offsetMm: 5, radiusMm: 0 }] };

  const withStaleNotch = buildWallPiece(run, grid, project).toPiece();
  const without = buildWallPiece(run, grid, { ...project, pieceNotches: {} }).toPiece();
  assert(JSON.stringify(withStaleNotch.outline) === JSON.stringify(without.outline), 'a notch under the plain key should no longer affect this wall\'s outline at all, since its topEdge is jointed, not free');
});

const COVERAGE_SIDES = ['top', 'bottom', 'left', 'right'];
const WALL_BY_SIDE = {
  top: { kind: 'h', line: 0 },
  bottom: { kind: 'h', line: 1 },
  left: { kind: 'v', line: 0 },
  right: { kind: 'v', line: 1 },
};
const FACING_SIDE = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };
const FLANK_SIDES = { top: ['left', 'right'], bottom: ['left', 'right'], left: ['top', 'bottom'], right: ['top', 'bottom'] };
const PANEL_FIELD_BY_SIDE = { top: 'bottomEdge', right: 'rightEdge', bottom: 'topEdge', left: 'leftEdge' };

function outerRun(project, kind, line) {
  return enumerateWallRuns(project.grid, project).find((r) => r.kind === kind && (kind === 'h' ? r.r : r.c) === line);
}

function wallOnSide(project, side) {
  const { kind, line } = WALL_BY_SIDE[side];
  return buildWallPiece(outerRun(project, kind, line), project.grid, project);
}

function outlineExtremeTowards(outline, side) {
  if (side === 'top') return Math.min(...outline.map((p) => p.y));
  if (side === 'bottom') return Math.max(...outline.map((p) => p.y));
  if (side === 'left') return Math.min(...outline.map((p) => p.x));
  return Math.max(...outline.map((p) => p.x));
}

function nominalEdgeTowards(rectangle, side) {
  if (side === 'bottom') return rectangle.depthMm;
  if (side === 'right') return rectangle.widthMm;
  return 0;
}

for (const coverageSide of COVERAGE_SIDES) {
  test(`buildHorizontalPanel() should end a ${coverageSide} coverage in a flat open edge, with no tab past it`, () => {
    const project = panelFixtureProject({ side: coverageSide, depthMm: 12 });
    const outline = onlyPanelOf(project).toPiece().outline;
    const rectangle = coverageRectangle(project.grid, project, project.horizontalPanels[0].coverage);
    const facingSide = FACING_SIDE[coverageSide];
    assertClose(outlineExtremeTowards(outline, facingSide), nominalEdgeTowards(rectangle, facingSide), 1e-6, `the ${facingSide} open edge should sit exactly on the coverage rectangle`);
  });
}

for (const coverageSide of COVERAGE_SIDES) {
  test(`buildHorizontalPanel() should give a ${coverageSide} coverage a simple outline fitting its coverage rectangle plus the outer thickness`, () => {
    const project = panelFixtureProject({ side: coverageSide, depthMm: 12 });
    const tabMm = project.outerThicknessMm;
    const outline = onlyPanelOf(project).toPiece().outline;
    const { widthMm, depthMm } = coverageRectangle(project.grid, project, project.horizontalPanels[0].coverage);
    assert(isSimplePolygon(outline), 'expected a simple polygon');
    for (const p of outline) {
      const inside = p.x >= -tabMm - 1e-6 && p.x <= widthMm + tabMm + 1e-6 && p.y >= -tabMm - 1e-6 && p.y <= depthMm + tabMm + 1e-6;
      assert(inside, `point ${JSON.stringify(p)} outside the ${widthMm}x${depthMm} coverage plus its tabs`);
    }
  });
}

test('buildWallPiece() should only cut panel mortises under the coverage on a flank wall', () => {
  const project = panelFixtureProject({ side: 'top', depthMm: 12 });
  const holes = wallOnSide(project, 'left').holes;
  assert(holes.length > 0, 'expected the flank wall to still hold the covered strip');
  for (const hole of holes) {
    assert(hole.xMm >= 0 && hole.xMm + hole.widthMm <= 12 + 1e-6, `expected every mortise within the 12mm coverage, got one spanning [${hole.xMm}, ${hole.xMm + hole.widthMm}]`);
  }
});

for (const coverageSide of COVERAGE_SIDES) {
  test(`buildWallPiece() should keep the full row of panel mortises on the wall a ${coverageSide} coverage leans against`, () => {
    const project = panelFixtureProject({ side: coverageSide, depthMm: 12 });
    const fullProject = panelFixtureProject(null);
    const covered = wallOnSide(project, coverageSide).holes;
    const full = wallOnSide(fullProject, coverageSide).holes;
    assert(JSON.stringify(covered) === JSON.stringify(full), `expected the same ${full.length} mortises as a full panel, got ${covered.length}`);
  });
}

for (const coverageSide of COVERAGE_SIDES) {
  test(`buildWallPiece() should cut no panel mortise at all on the wall facing the open edge of a ${coverageSide} coverage`, () => {
    const project = panelFixtureProject({ side: coverageSide, depthMm: 50 });
    const holes = wallOnSide(project, FACING_SIDE[coverageSide]).holes;
    assert(holes.length === 0, `expected no mortise on the facing wall, got ${holes.length}`);
  });
}

for (const coverageSide of COVERAGE_SIDES) {
  test(`buildHorizontalPanel() should land every flank tab of a ${coverageSide} coverage on a mortise of the matching wall`, () => {
    const project = panelFixtureProject({ side: coverageSide, depthMm: 50 });
    const panel = onlyPanelOf(project);
    const { xMm, yMm } = coverageRectangle(project.grid, project, project.horizontalPanels[0].coverage);
    for (const flankSide of FLANK_SIDES[coverageSide]) {
      const offsetMm = WALL_BY_SIDE[flankSide].kind === 'v' ? yMm : xMm;
      const tabs = panel[PANEL_FIELD_BY_SIDE[flankSide]].segments()
        .filter((s) => s.kind === 'finger')
        .map((s) => [s.start + offsetMm, s.length]);
      const mortises = wallOnSide(project, flankSide).holes.map((h) => [h.xMm, h.widthMm]);
      assert(tabs.length > 0, `sanity check: the ${flankSide} flank should carry at least one tab`);
      assert(JSON.stringify(tabs) === JSON.stringify(mortises), `${flankSide} flank: tabs ${JSON.stringify(tabs)} vs mortises ${JSON.stringify(mortises)}`);
    }
  });
}

test('buildHorizontalPanel() should skip the divider junction a coverage crosses, exactly where the flank wall skips it', () => {
  const project = createM2ExampleProject();
  project.innerHeightMm = 30;
  project.horizontalPanels = [{ id: 'horizontal-panel-1', heightMm: 35, coverage: { side: 'top', depthMm: 120 } }];
  const panel = onlyPanelOf(project);
  const tabs = panel.leftEdge.segments().filter((s) => s.kind === 'finger').map((s) => [s.start, s.length]);
  const panelMortises = buildWallPiece(outerRun(project, 'v', 0), project.grid, project).holes
    .filter((h) => Math.abs(h.yMm - project.horizontalPanels[0].heightMm) < 1e-6)
    .map((h) => [h.xMm, h.widthMm]);
  const dividerY = yAt(project.grid, project, 1);
  const dividerHalfThicknessMm = project.innerThicknessMm / 2;
  const tabClearsDivider = ([start, length]) => start > dividerY + dividerHalfThicknessMm || start + length < dividerY - dividerHalfThicknessMm;
  assert(tabs.every(tabClearsDivider), `expected no tab across the divider at y=${dividerY}, got ${JSON.stringify(tabs)}`);
  assert(JSON.stringify(tabs) === JSON.stringify(panelMortises), `tabs ${JSON.stringify(tabs)} vs mortises ${JSON.stringify(panelMortises)}`);
  assert(isSimplePolygon(panel.toPiece().outline), 'expected a simple polygon');
});

test('coverageHoldsFlankTabs() should say a 10mm coverage has no flank tab with the default 5mm margin', () => {
  const project = panelFixtureProject({ side: 'top', depthMm: 10 });
  assert(coverageHoldsFlankTabs(project.grid, project, project.horizontalPanels[0].coverage) === false, 'expected no room for a tab between the two 5mm margins');
});

test('coverageHoldsFlankTabs() should say a 12mm coverage holds a tab on each flank', () => {
  const project = panelFixtureProject({ side: 'top', depthMm: 12 });
  assert(coverageHoldsFlankTabs(project.grid, project, project.horizontalPanels[0].coverage) === true, 'expected one tab to fit once the coverage is wider than the two margins');
});

test('coverageHoldsFlankTabs() should hold a tab on each flank of a 12mm left coverage, just like a top one', () => {
  const project = panelFixtureProject({ side: 'left', depthMm: 12 });
  assert(coverageHoldsFlankTabs(project.grid, project, project.horizontalPanels[0].coverage) === true, 'expected the flanks to start with a tab whatever the wall orientation');
});

run();
