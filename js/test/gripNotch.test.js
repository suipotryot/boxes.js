// Grip notch (encoche pour doigt) — see js/geometry/GripNotch.js's own
// header comment for the design: one shape family, a corner radius from 0
// (sharp) up to its own geometric max, always cut into the run's own free
// edge (never a separate holes[] entry — see BurnCorrection.js's own
// header comment on why a "touching hole" can drift under burn
// correction). A piece can have SEVERAL — project.pieceNotches[pieceId]
// is a list, not a single notch.
import { test, assert, assertClose, run } from './testHarness.js';
import { createGrid } from '../model/Grid.js';
import { createDefaultProject } from '../state/Project.js';
import { gripNotchOverride, maxRadiusMm, notchListFor, formatNotchLine, parseNotchLine } from '../geometry/GripNotch.js';
import { validateGripNotch } from '../geometry/GripNotchValidation.js';
import { buildWallPanel, bottomCombSegments } from '../geometry/PanelBuilder.js';
import { enumerateWallRuns } from '../model/GridQuery.js';
import { buildDrawerBox, buildSleeveContext, DRAWER_PREFIX } from '../geometry/DrawerBuilder.js';
import { resolveWallRunContext } from '../geometry/PieceContext.js';
import { computePieces } from '../geometry/PieceFactory.js';
import { burnCorrect } from '../geometry/BurnCorrection.js';

function segmentsIntersect(p1, p2, p3, p4) {
  const cross = (a, b) => a.x * b.y - a.y * b.x;
  const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
  const d1 = cross(sub(p4, p3), sub(p1, p3));
  const d2 = cross(sub(p4, p3), sub(p2, p3));
  const d3 = cross(sub(p2, p1), sub(p3, p1));
  const d4 = cross(sub(p2, p1), sub(p4, p1));
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}
function isSimplePolygon(points) {
  const n = points.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const shareVertex = j === i || (j + 1) % n === i || j === (i + 1) % n;
      if (shareVertex) continue;
      if (segmentsIntersect(points[i], points[(i + 1) % n], points[j], points[(j + 1) % n])) return false;
    }
  }
  return true;
}

function baseProject() {
  const project = createDefaultProject();
  project.grid = createGrid([150], [100]); // single cell, no interior dividers
  project.outerThicknessMm = 3;
  project.outerHeightMm = 50;
  return project;
}

// --- gripNotchOverride: pure shape math ---

test('gripNotchOverride: radius 0 gives exactly 2 flat points', () => {
  const notch = { widthMm: 30, depthMm: 10, offsetMm: 20, radiusMm: 0 };
  const localHeight = 50;
  const ov = gripNotchOverride(notch, localHeight);
  assert(ov.points.length === 2);
  assertClose(ov.points[0].y, 40, 1e-9);
  assertClose(ov.points[1].y, 40, 1e-9);
  assertClose(ov.points[0].u, 20, 1e-9);
  assertClose(ov.points[1].u, 50, 1e-9);
});

test('gripNotchOverride: intermediate radius keeps a flat floor stretch and matches the analytic circle', () => {
  const notch = { widthMm: 30, depthMm: 20, offsetMm: 20, radiusMm: 8 };
  const localHeight = 50;
  const floor = localHeight - notch.depthMm; // 30
  const ov = gripNotchOverride(notch, localHeight);
  const flatFloorPoints = ov.points.filter((p) => Math.abs(p.y - floor) < 1e-6);
  const flatXs = new Set(flatFloorPoints.map((p) => Math.round(p.u * 1000)));
  assert(flatXs.size >= 2, 'expected at least 2 distinct u positions at the flat floor');

  const leftCenter = { u: notch.offsetMm + notch.radiusMm, y: floor + notch.radiusMm };
  const rightCenter = { u: notch.offsetMm + notch.widthMm - notch.radiusMm, y: floor + notch.radiusMm };
  for (const p of ov.points) {
    const dL = Math.hypot(p.u - leftCenter.u, p.y - leftCenter.y);
    const dR = Math.hypot(p.u - rightCenter.u, p.y - rightCenter.y);
    const onLeft = Math.abs(dL - notch.radiusMm) < 1e-6;
    const onRight = Math.abs(dR - notch.radiusMm) < 1e-6;
    const onFlatFloor = Math.abs(p.y - floor) < 1e-6;
    assert(onLeft || onRight || onFlatFloor, `point (${p.u},${p.y}) is not on either fillet arc nor the flat floor`);
  }
});

test('gripNotchOverride: radius pushed to its max with depth=width/2 degenerates to a full semicircle (no flat floor, no residual vertical wall)', () => {
  const notch = { widthMm: 30, depthMm: 15, offsetMm: 20, radiusMm: 15 };
  const localHeight = 50;
  const ov = gripNotchOverride(notch, localHeight);
  const floor = localHeight - notch.depthMm;
  const distinctFloorXs = new Set(ov.points.filter((p) => Math.abs(p.y - floor) < 1e-6).map((p) => Math.round(p.u * 1000)));
  assert(distinctFloorXs.size === 1, 'a full semicircle should touch the floor at exactly one point (the center), not a flat stretch');
  assertClose(ov.points[0].y, localHeight, 1e-6);
  assertClose(ov.points[ov.points.length - 1].y, localHeight, 1e-6);
  const center = { u: notch.offsetMm + notch.widthMm / 2, y: floor + notch.radiusMm };
  for (const p of ov.points) assertClose(Math.hypot(p.u - center.u, p.y - center.y), notch.radiusMm, 1e-6);
});

test('gripNotchOverride: a radius beyond its own geometric max is clamped defensively, u stays monotonic (no crossing arcs)', () => {
  const notch = { widthMm: 20, depthMm: 5, offsetMm: 10, radiusMm: 1000 };
  const ov = gripNotchOverride(notch, 50);
  for (let i = 1; i < ov.points.length; i++) {
    assert(ov.points[i].u >= ov.points[i - 1].u - 1e-6, 'u should never decrease along the notch outline — a crossing would double back on itself');
  }
  const us = ov.points.map((p) => p.u);
  assert(Math.min(...us) >= notch.offsetMm - 1e-6 && Math.max(...us) <= notch.offsetMm + notch.widthMm + 1e-6);
});

// --- notchListFor: normalizing what's actually stored ---

test('notchListFor: a real array passes through unchanged', () => {
  const list = [{ widthMm: 10, depthMm: 5, offsetMm: 0, radiusMm: 0 }];
  assert(notchListFor({ id1: list }, 'id1') === list);
});

test('notchListFor: a legacy single-object shape with enabled:true becomes a 1-element list', () => {
  const legacy = { enabled: true, widthMm: 10, depthMm: 5, offsetMm: 0, radiusMm: 0 };
  const result = notchListFor({ id1: legacy }, 'id1');
  assert(Array.isArray(result) && result.length === 1 && result[0] === legacy);
});

test('notchListFor: a legacy object with enabled:false, or a missing entry, becomes an empty list', () => {
  assert(notchListFor({ id1: { enabled: false, widthMm: 10, depthMm: 5, offsetMm: 0, radiusMm: 0 } }, 'id1').length === 0);
  assert(notchListFor({}, 'id1').length === 0);
  assert(notchListFor(undefined, 'id1').length === 0);
});

// --- formatNotchLine / parseNotchLine: the single copy/paste-able text field ---

test('formatNotchLine/parseNotchLine round-trip a well-formed notch', () => {
  const notch = { widthMm: 20.5, depthMm: 8, radiusMm: 0, offsetMm: 10 };
  const line = formatNotchLine(notch);
  assert(line === '20.5, 8, 0, 10', `unexpected format: "${line}"`);
  const parsed = parseNotchLine(line);
  assertClose(parsed.widthMm, notch.widthMm, 1e-9);
  assertClose(parsed.depthMm, notch.depthMm, 1e-9);
  assertClose(parsed.radiusMm, notch.radiusMm, 1e-9);
  assertClose(parsed.offsetMm, notch.offsetMm, 1e-9);
});

test('parseNotchLine rejects malformed input rather than guessing', () => {
  assert(parseNotchLine('20, 8, 0') === null, 'only 3 values should be rejected');
  assert(parseNotchLine('20, 8, 0, 10, 5') === null, '5 values should be rejected');
  assert(parseNotchLine('20, huit, 0, 10') === null, 'a non-numeric token should be rejected');
  assert(parseNotchLine('20,5, 8, 0, 10') === null, 'a French decimal comma ("20,5" meant as one number) must NOT silently become width=20 — the whole line has 5 tokens and should be rejected, not misparsed');
  assert(parseNotchLine('20, , 0, 10') === null, 'an empty token between commas should be rejected, not silently become 0');
});

test('parseNotchLine accepts a period as the decimal separator and trims whitespace', () => {
  const parsed = parseNotchLine(' 20.5 ,8,0.0, 10 ');
  assert(parsed !== null);
  assertClose(parsed.widthMm, 20.5, 1e-9);
  assertClose(parsed.depthMm, 8, 1e-9);
});

// --- integration: an ordinary (non-drawer) outer wall ---

test('a square (radius 0) grip notch on an ordinary outer wall cuts the free edge, contour stays simple', () => {
  const project = baseProject();
  project.pieceNotches = { 'wall-h-0-0': [{ widthMm: 30, depthMm: 10, offsetMm: 20, radiusMm: 0 }] };
  const run = enumerateWallRuns(project.grid, project).find((r) => r.kind === 'h' && r.r === 0);
  const piece = buildWallPanel(run, project.grid, project, true);
  assert(isSimplePolygon(piece.outline), 'notched outline self-intersects');
  const floorPoints = piece.outline.filter((p) => p.x >= 20 - 1e-6 && p.x <= 50 + 1e-6 && Math.abs(p.y - 40) < 1e-6);
  assert(floorPoints.length === 2, `expected exactly 2 points at the notch floor, got ${floorPoints.length}`);
});

test('a rounded grip notch stays simple before and after burn correction, and the deepest point grows deeper (not shallower)', () => {
  const project = baseProject();
  project.pieceNotches = { 'wall-h-0-0': [{ widthMm: 30, depthMm: 15, offsetMm: 20, radiusMm: 15 }] };
  const run = enumerateWallRuns(project.grid, project).find((r) => r.kind === 'h' && r.r === 0);
  const raw = buildWallPanel(run, project.grid, project, true);
  assert(isSimplePolygon(raw.outline), 'raw notched outline self-intersects');
  const corrected = burnCorrect(raw, project.burnMm);
  assert(isSimplePolygon(corrected.outline), 'burn-corrected notched outline self-intersects');

  const rawMinY = Math.min(...raw.outline.map((p) => p.y));
  const correctedMinY = Math.min(...corrected.outline.map((p) => p.y));
  assert(correctedMinY < rawMinY, `burn correction should dig the notch slightly deeper (${correctedMinY} should be < ${rawMinY}), not shallower — sign-flip regression check`);
});

test('two grip notches on the same wall (square + rounded, disjoint) both cut, contour stays simple', () => {
  const project = baseProject();
  project.pieceNotches = {
    'wall-h-0-0': [
      { widthMm: 20, depthMm: 8, offsetMm: 10, radiusMm: 0 },
      { widthMm: 20, depthMm: 10, offsetMm: 100, radiusMm: 10 },
    ],
  };
  const run = enumerateWallRuns(project.grid, project).find((r) => r.kind === 'h' && r.r === 0);
  const piece = buildWallPanel(run, project.grid, project, true);
  assert(isSimplePolygon(piece.outline), 'contour with 2 notches self-intersects');

  const firstFloor = piece.outline.filter((p) => p.x >= 10 - 1e-6 && p.x <= 30 + 1e-6 && Math.abs(p.y - 42) < 1e-6);
  assert(firstFloor.length === 2, 'expected the first (square) notch\'s flat floor to be present');
  const secondFloorY = 40; // 50 - 10
  const secondNear = piece.outline.filter((p) => p.x >= 100 - 1e-6 && p.x <= 120 + 1e-6 && Math.abs(p.y - secondFloorY) < 1e-6);
  assert(secondNear.length >= 1, 'expected the second (rounded) notch to reach its own floor depth');
});

test('no pieceNotches entry (or an empty list) leaves every piece exactly as before', () => {
  const project = baseProject();
  const before = computePieces(project);
  project.pieceNotches = { 'wall-h-0-0': [] };
  const after = computePieces(project);
  assert(before.length === after.length);
  for (let i = 0; i < before.length; i++) {
    assert(JSON.stringify(before[i].outline) === JSON.stringify(after[i].outline), `piece ${before[i].id} changed despite an empty notch list`);
  }
});

// --- integration: a drawer sleeve wall, via lidTopEdgePoints specifically ---

test('a grip notch on a drawer wall removes a real finger tab (lidTopEdgePoints path), proving the feature reaches its own motivating case', () => {
  const project = baseProject();
  project.drawer = { enabled: true, playMm: 1, thicknessMm: 3, openSide: 'right' };

  const ctxBefore = buildSleeveContext(project.grid, project);
  const wallRun = enumerateWallRuns(ctxBefore.sleeveGrid, ctxBefore.sleeveProject).find((r) => r.kind === 'h' && r.r === 0);
  const fingerSeg = bottomCombSegments(wallRun, ctxBefore.sleeveGrid, ctxBefore.sleeveProject).find((s) => s.kind === 'finger');
  assert(fingerSeg, 'expected at least one finger segment on this drawer wall to target');

  const drawerPieceId = `${DRAWER_PREFIX}wall-h-0-0`;

  function tabPresentInRange(pieces, seg) {
    const wall = pieces.find((p) => p.id === drawerPieceId);
    // A present (un-notched) tab reaches EXACTLY outerHeightMm — the lid's
    // own top face, flush, no protrusion past it (PanelBuilder.
    // lidTopEdgePoints). Matching that exact value, rather than any point
    // above some threshold, is what a naive ">insertHeightMm" check gets
    // wrong for a ROUNDED notch (radiusMm>0): when the notch's own depth
    // doesn't fully clear depthMm below radiusMm, its fillet's own corner
    // briefly passes back through the insertHeightMm..outerHeightMm band
    // right at the notch's edge (a real, correctly-carved short vertical
    // wall — see GripNotch.gripNotchOverride's own doc comment — not a
    // leftover tab), which a ">threshold" check can't tell apart from one.
    return wall.outline.some((p) => p.x >= seg.start - 1e-6 && p.x <= seg.start + seg.length + 1e-6 && Math.abs(p.y - ctxBefore.sleeveProject.outerHeightMm) < 1e-6);
  }

  const withoutNotch = buildDrawerBox(project.grid, project);
  assert(tabPresentInRange(withoutNotch, fingerSeg), 'sanity check: the finger tab should be present without any notch');

  project.pieceNotches = {
    [drawerPieceId]: [{ widthMm: fingerSeg.length, depthMm: 5, offsetMm: fingerSeg.start, radiusMm: 0 }],
  };
  const withNotch = buildDrawerBox(project.grid, project);
  assert(!tabPresentInRange(withNotch, fingerSeg), 'the grip notch should have removed the finger tab in its own range');
  assert(isSimplePolygon(withNotch.find((p) => p.id === drawerPieceId).outline), 'notched drawer wall outline self-intersects');
});

test('two grip notches on a drawer wall each remove their own, independent finger tab', () => {
  const project = baseProject();
  project.drawer = { enabled: true, playMm: 1, thicknessMm: 3, openSide: 'right' };

  const ctxBefore = buildSleeveContext(project.grid, project);
  const wallRun = enumerateWallRuns(ctxBefore.sleeveGrid, ctxBefore.sleeveProject).find((r) => r.kind === 'h' && r.r === 0);
  const fingerSegs = bottomCombSegments(wallRun, ctxBefore.sleeveGrid, ctxBefore.sleeveProject).filter((s) => s.kind === 'finger');
  assert(fingerSegs.length >= 2, 'expected at least 2 finger segments on this drawer wall to target independently');
  const [segA, segB] = fingerSegs;

  const drawerPieceId = `${DRAWER_PREFIX}wall-h-0-0`;
  function tabPresentInRange(pieces, seg) {
    const wall = pieces.find((p) => p.id === drawerPieceId);
    // A present (un-notched) tab reaches EXACTLY outerHeightMm — matching
    // that exact value, rather than any point above some threshold, is
    // what a rounded notch's own short corner fillet needs: it can
    // briefly pass back through the insertHeightMm..outerHeightMm band
    // right at the notch's edge (a real, correctly-carved short vertical
    // wall — see GripNotch.gripNotchOverride's own doc comment — not a
    // leftover tab), which a ">threshold" check can't tell apart from one.
    return wall.outline.some((p) => p.x >= seg.start - 1e-6 && p.x <= seg.start + seg.length + 1e-6 && Math.abs(p.y - ctxBefore.sleeveProject.outerHeightMm) < 1e-6);
  }

  project.pieceNotches = {
    [drawerPieceId]: [
      { widthMm: segA.length, depthMm: 5, offsetMm: segA.start, radiusMm: 0 },
      { widthMm: segB.length, depthMm: 4, offsetMm: segB.start, radiusMm: 2 },
    ],
  };
  const pieces = buildDrawerBox(project.grid, project);
  assert(!tabPresentInRange(pieces, segA), 'the first notch should have removed its own tab');
  assert(!tabPresentInRange(pieces, segB), 'the second notch should have independently removed its own tab');
  assert(isSimplePolygon(pieces.find((p) => p.id === drawerPieceId).outline), 'doubly-notched drawer wall outline self-intersects');
});

// --- validation ---

test('validateGripNotch: rejects the expected cases, accepts a well-formed one', () => {
  const project = baseProject();
  const run = enumerateWallRuns(project.grid, project).find((r) => r.kind === 'h' && r.r === 0);

  assert(!validateGripNotch(run, project.grid, project, { widthMm: 30, depthMm: 10, offsetMm: -5, radiusMm: 0 }).ok, 'negative offset should be rejected');
  assert(!validateGripNotch(run, project.grid, project, { widthMm: 0, depthMm: 10, offsetMm: 10, radiusMm: 0 }).ok, 'zero width should be rejected');
  assert(!validateGripNotch(run, project.grid, project, { widthMm: 30, depthMm: 10, offsetMm: 10, radiusMm: 20 }).ok, 'radius beyond its own max should be rejected');
  assert(!validateGripNotch(run, project.grid, project, { widthMm: 30, depthMm: 10, offsetMm: 140, radiusMm: 0 }).ok, 'a notch extending past the run\'s own length should be rejected');
  assert(!validateGripNotch(run, project.grid, project, { widthMm: 30, depthMm: 55, offsetMm: 10, radiusMm: 0 }).ok, 'depth >= local height should be rejected');

  const ok = validateGripNotch(run, project.grid, project, { widthMm: 30, depthMm: 10, offsetMm: 20, radiusMm: 5 });
  assert(ok.ok, `expected a well-formed notch to validate, got problems: ${ok.problems.join('; ')}`);
});

test('validateGripNotch: rejects a notch overlapping a T-junction mortise', () => {
  const project = createDefaultProject();
  project.grid = createGrid([80, 80], [100]); // T junction: interior divider at c=1
  const run = enumerateWallRuns(project.grid, project).find((r) => r.kind === 'h' && r.r === 0);
  const overlapping = validateGripNotch(run, project.grid, project, { widthMm: 20, depthMm: 5, offsetMm: 75, radiusMm: 0 });
  assert(!overlapping.ok, 'a notch straddling the T-junction mortise should be rejected');
});

test('validateGripNotch: rejects two sibling notches on the same wall that overlap, accepts disjoint ones', () => {
  const project = baseProject();
  const run = enumerateWallRuns(project.grid, project).find((r) => r.kind === 'h' && r.r === 0);
  const a = { widthMm: 20, depthMm: 5, offsetMm: 10, radiusMm: 0 };

  const overlappingSibling = { widthMm: 20, depthMm: 5, offsetMm: 25, radiusMm: 0 }; // [25,45) overlaps [10,30)
  const overlapResult = validateGripNotch(run, project.grid, project, a, [overlappingSibling]);
  assert(!overlapResult.ok, 'overlapping sibling notches should be rejected');
  assert(overlapResult.problems.some((p) => p.includes('chevauche une autre encoche')));

  const disjointSibling = { widthMm: 20, depthMm: 5, offsetMm: 40, radiusMm: 0 }; // [40,60) does not overlap [10,30)
  const disjointResult = validateGripNotch(run, project.grid, project, a, [disjointSibling]);
  assert(disjointResult.ok, `expected disjoint sibling notches to validate, got: ${disjointResult.problems.join('; ')}`);
});

// --- PieceContext round-trip ---

test('resolveWallRunContext for a drawer piece resolves a run that rebuilds identically to buildDrawerBox\'s own output', () => {
  const project = baseProject();
  project.drawer = { enabled: true, playMm: 1, thicknessMm: 3, openSide: 'right' };
  project.pieceNotches = { [`${DRAWER_PREFIX}wall-h-0-0`]: [{ widthMm: 20, depthMm: 5, offsetMm: 10, radiusMm: 2 }] };

  const pieceId = `${DRAWER_PREFIX}wall-h-0-0`;
  const ctx = resolveWallRunContext(project, pieceId);
  assert(ctx !== null, 'expected the drawer wall to resolve');

  const rebuilt = buildWallPanel(ctx.run, ctx.grid, ctx.project, true);
  const fromPipeline = buildDrawerBox(project.grid, project).find((p) => p.id === pieceId);
  assert(JSON.stringify(rebuilt.outline) === JSON.stringify(fromPipeline.outline), 'the resolved context should rebuild byte-for-byte the same outline as the real pipeline');
});

test('resolveWallRunContext returns null for base-plate/lid ids (out of scope for grip notches)', () => {
  const project = baseProject();
  assert(resolveWallRunContext(project, 'base-plate') === null);
  project.lid = { enabled: true, insertHeightMm: 47 };
  assert(resolveWallRunContext(project, 'lid') === null);
});

run();
