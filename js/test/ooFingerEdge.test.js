// FingerEdge: a toothed edge, tiled by the shared FingerJoint.fingerEdgePath.
// The complementary-phase test below is the direct proof behind the plan's
// key simplification: two FingerEdge instances facing each other need no
// reference to one another (see FingerEdge.js's own header comment).
import { test, assert, assertClose, run } from './testHarness.js';
import { createGrid } from '../model/Grid.js';
import { createDefaultProject } from '../state/Project.js';
import { enumerateWallRuns } from '../model/GridQuery.js';
import { FingerEdge } from '../geometry/oo/FingerEdge.js';
import { fingerEdgePath } from '../geometry/FingerJoint.js';
import { bottomCombSegments, junctionExclusionRanges, lidTopEdgePoints, heightProfile } from '../geometry/PanelBuilder.js';

const fj = { fingerMm: 20, spaceMm: 20, marginMm: 5, playMm: 0 };

test('segments() matches a direct fingerEdgePath call with the same parameters', () => {
  const edge = new FingerEdge({ lengthMm: 123, fingerJoint: fj, startWithFinger: true, mateThicknessMm: 3 });
  const direct = fingerEdgePath(123, fj, true);
  assert(JSON.stringify(edge.segments()) === JSON.stringify(direct));
});

test('baseValueAt: mateThicknessMm at a finger segment, 0 at a flush/space segment', () => {
  const edge = new FingerEdge({ lengthMm: 123, fingerJoint: fj, startWithFinger: true, mateThicknessMm: 3 });
  for (const seg of edge.segments()) {
    const mid = seg.start + seg.length / 2;
    const expected = seg.kind === 'finger' ? 3 : 0;
    assertClose(edge.baseValueAt(mid), expected, 1e-9, `segment kind=${seg.kind}`);
  }
});

test('points(): every point sits at either 0 or mateThicknessMm, matching its segment\'s kind', () => {
  const edge = new FingerEdge({ lengthMm: 100, fingerJoint: fj, startWithFinger: false, mateThicknessMm: 4 });
  const pts = edge.points();
  for (const p of pts) assert(p.y === 0 || p.y === 4, `unexpected y=${p.y}`);
});

test('extendToTips: without it, the outermost segments are the ordinary flush margin; with it, the first/last points reach 0/lengthMm at the full mateThicknessMm', () => {
  const lengthMm = 100;
  const plain = new FingerEdge({ lengthMm, fingerJoint: fj, startWithFinger: true, mateThicknessMm: 5 });
  const extended = new FingerEdge({ lengthMm, fingerJoint: fj, startWithFinger: true, mateThicknessMm: 5, extendToTips: true });

  assertClose(plain.baseValueAt(0.01), 0, 1e-9, 'sanity check: without extendToTips, the very start is flush');
  assertClose(extended.baseValueAt(0.01), 5, 1e-9, 'with extendToTips, the very start should already be a full tooth');
  assertClose(extended.baseValueAt(lengthMm - 0.01), 5, 1e-9, 'with extendToTips, the very end should also already be a full tooth');
});

test('complementary phase: two FingerEdge instances with opposite startWithFinger tile at IDENTICAL boundaries, with swapped finger/flush kinds — no reference between them required', () => {
  const lengthMm = 137; // deliberately not a clean multiple of the tooth cycle
  const mine = new FingerEdge({ lengthMm, fingerJoint: fj, startWithFinger: true, mateThicknessMm: 3 });
  const mate = new FingerEdge({ lengthMm, fingerJoint: fj, startWithFinger: false, mateThicknessMm: 7 });

  const mySegs = mine.segments();
  const mateSegs = mate.segments();
  assert(mySegs.length === mateSegs.length, 'both phases should produce the same segment count');
  for (let i = 0; i < mySegs.length; i++) {
    assertClose(mySegs[i].start, mateSegs[i].start, 1e-9, `segment ${i} start should match exactly`);
    assertClose(mySegs[i].length, mateSegs[i].length, 1e-9, `segment ${i} length should match exactly`);
    if (mySegs[i].kind !== 'flush') { // the two flush margins have no complementary counterpart to swap with
      const expectedMateKind = mySegs[i].kind === 'finger' ? 'space' : 'finger';
      assert(mateSegs[i].kind === expectedMateKind, `segment ${i}: mine=${mySegs[i].kind}, expected mate=${expectedMateKind}, got ${mateSegs[i].kind}`);
    }
  }

  // Physically: exactly where I protrude toward my mate (my own value =
  // mateThicknessMm = 3), my mate must stay flush (its own value = 0) —
  // and vice versa. Sampled at every segment's own midpoint.
  for (const seg of mySegs) {
    const mid = seg.start + seg.length / 2;
    const myValue = mine.baseValueAt(mid);
    const mateValue = mate.baseValueAt(mid);
    assert(!(myValue > 0 && mateValue > 0), `at u=${mid}, both sides protrude simultaneously (myValue=${myValue}, mateValue=${mateValue}) — they'd collide instead of interlocking`);
  }
});

test('exclusions: without any, segments() is unaffected (default empty array preserves the plain-tiling behavior)', () => {
  const edge = new FingerEdge({ lengthMm: 222, fingerJoint: fj, startWithFinger: false, mateThicknessMm: 3 });
  assert(JSON.stringify(edge.segments()) === JSON.stringify(fingerEdgePath(222, fj, false)));
});

test('exclusions: segments() matches bottomCombSegments exactly on a real 2x2 grid outer wall with a mid-run T junction — the exact gap this test suite previously missed (a divider touching an outer wall mid-span)', () => {
  const project = createDefaultProject();
  project.grid = createGrid([90, 130], [70, 100]); // 2x2: the top outer wall gets a T-junction stem mid-run
  project.outerThicknessMm = 3;
  project.innerThicknessMm = 2;
  const run = enumerateWallRuns(project.grid, project).find((r) => r.kind === 'h' && r.r === 0);

  const expected = bottomCombSegments(run, project.grid, project);
  const exclusions = junctionExclusionRanges(run, project.grid, project);
  assert(exclusions.length > 0, 'sanity check: this scenario should actually have a mid-run exclusion to portion around');

  const edge = new FingerEdge({
    lengthMm: run.length, fingerJoint: project.fingerJoint, startWithFinger: run.kind === 'v',
    mateThicknessMm: project.outerThicknessMm, exclusions,
  });
  assert(JSON.stringify(edge.segments()) === JSON.stringify(expected), 'portioned tiling should match bottomCombSegments exactly, not just a plain whole-length comb');

  // And confirm a PLAIN (no-exclusions) comb would have been WRONG here —
  // proving this isn't a vacuous check.
  const plain = fingerEdgePath(run.length, project.fingerJoint, run.kind === 'v');
  assert(JSON.stringify(plain) !== JSON.stringify(expected), 'sanity check: the plain whole-length comb must actually differ from the portioned one in this scenario');
});

test('forceEndsToFinger: unconditionally reaches the tip at BOTH ends, even when the comb\'s own first/last segment is a space, not a finger', () => {
  // startWithFinger=false makes the first/last alternating segment
  // 'space' (verified empirically against fingerEdgePath directly before
  // writing this) — extendToTips would do nothing here; forceEnds must
  // still reach the tip regardless.
  const edge = new FingerEdge({ lengthMm: 100, fingerJoint: fj, startWithFinger: false, mateThicknessMm: 5, forceEndsToFinger: true });
  assertClose(edge.baseValueAt(0.01), 5, 1e-9, 'the very start should reach the full tip even though startWithFinger=false leaves it space-adjacent');
  assertClose(edge.baseValueAt(99.99), 5, 1e-9, 'the very end should too');
});

test('forceEndsToFinger matches PanelBuilder.lidTopEdgePoints\' own `atEnd` rule exactly — including the h-run case (startWithFinger=false) where the plain comb phase would NOT naturally reach the tip', () => {
  const project = createDefaultProject();
  project.grid = createGrid([100], [80]);
  project.outerThicknessMm = 3;
  project.outerHeightMm = 40;
  const wallRun = enumerateWallRuns(project.grid, project).find((r) => r.kind === 'h' && r.r === 0);

  const spans = heightProfile(wallRun, project.grid, project);
  const height = spans[spans.length - 1].height;
  const protrusion = project.outerThicknessMm;
  const old = lidTopEdgePoints(wallRun, project.grid, project, height, []);

  const edge = new FingerEdge({
    lengthMm: wallRun.length, fingerJoint: project.fingerJoint, startWithFinger: wallRun.kind === 'v',
    mateThicknessMm: protrusion, forceEndsToFinger: true, baselineMm: height - protrusion, signMm: 1,
    exclusions: junctionExclusionRanges(wallRun, project.grid, project),
  });
  const mine = edge.points().map((p) => ({ x: p.u, y: p.y }));

  const sortedRounded = (pts) => pts.map((p) => `${p.x.toFixed(6)},${p.y.toFixed(6)}`).sort();
  assert(JSON.stringify(sortedRounded(old)) === JSON.stringify(sortedRounded(mine)), 'should match lidTopEdgePoints exactly, point-for-point');
});

run();
