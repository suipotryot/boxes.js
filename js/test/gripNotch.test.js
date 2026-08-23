// Grip notch (encoche pour doigt) — see js/geometry/GripNotch.js's own
// header comment for the design: one shape family, a corner radius from 0
// (sharp) up to its own geometric max, always cut into the run's own free
// edge (never a separate holes[] entry — see BurnCorrection.js's own
// header comment on why a "touching hole" can drift under burn
// correction).
import { test, assert, assertClose, run } from './testHarness.js';
import { createGrid } from '../model/Grid.js';
import { createDefaultProject } from '../state/Project.js';
import { gripNotchOverride, maxRadiusMm, DEFAULT_GRIP_NOTCH } from '../geometry/GripNotch.js';
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
  const notch = { enabled: true, widthMm: 30, depthMm: 10, offsetMm: 20, radiusMm: 0 };
  const localHeight = 50;
  const ov = gripNotchOverride(notch, localHeight);
  assert(ov.points.length === 2);
  assertClose(ov.points[0].y, 40, 1e-9);
  assertClose(ov.points[1].y, 40, 1e-9);
  assertClose(ov.points[0].u, 20, 1e-9);
  assertClose(ov.points[1].u, 50, 1e-9);
});

test('gripNotchOverride: intermediate radius keeps a flat floor stretch and matches the analytic circle', () => {
  const notch = { enabled: true, widthMm: 30, depthMm: 20, offsetMm: 20, radiusMm: 8 };
  const localHeight = 50;
  const floor = localHeight - notch.depthMm; // 30
  const ov = gripNotchOverride(notch, localHeight);
  const flatFloorPoints = ov.points.filter((p) => Math.abs(p.y - floor) < 1e-6);
  const flatXs = new Set(flatFloorPoints.map((p) => Math.round(p.u * 1000)));
  assert(flatXs.size >= 2, 'expected at least 2 distinct u positions at the flat floor');

  // Every arc point must lie exactly on its own corner's circle.
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
  const notch = { enabled: true, widthMm: 30, depthMm: 15, offsetMm: 20, radiusMm: 15 };
  const localHeight = 50;
  const ov = gripNotchOverride(notch, localHeight);
  // The two fillets meet exactly at the center — no flat-floor point pushed.
  const floor = localHeight - notch.depthMm;
  const distinctFloorXs = new Set(ov.points.filter((p) => Math.abs(p.y - floor) < 1e-6).map((p) => Math.round(p.u * 1000)));
  assert(distinctFloorXs.size === 1, 'a full semicircle should touch the floor at exactly one point (the center), not a flat stretch');
  // Both extremities land exactly at localHeight (zero-length vertical wall).
  assertClose(ov.points[0].y, localHeight, 1e-6);
  assertClose(ov.points[ov.points.length - 1].y, localHeight, 1e-6);
  // Every point lies on the one circle of radius = widthMm/2 centered at mid-width, floor+radius.
  const center = { u: notch.offsetMm + notch.widthMm / 2, y: floor + notch.radiusMm };
  for (const p of ov.points) assertClose(Math.hypot(p.u - center.u, p.y - center.y), notch.radiusMm, 1e-6);
});

test('gripNotchOverride: a radius beyond its own geometric max is clamped defensively, u stays monotonic (no crossing arcs)', () => {
  const notch = { enabled: true, widthMm: 20, depthMm: 5, offsetMm: 10, radiusMm: 1000 };
  const ov = gripNotchOverride(notch, 50);
  for (let i = 1; i < ov.points.length; i++) {
    assert(ov.points[i].u >= ov.points[i - 1].u - 1e-6, 'u should never decrease along the notch outline — a crossing would double back on itself');
  }
  const us = ov.points.map((p) => p.u);
  assert(Math.min(...us) >= notch.offsetMm - 1e-6 && Math.max(...us) <= notch.offsetMm + notch.widthMm + 1e-6);
});

// --- integration: an ordinary (non-drawer) outer wall ---

test('a square (radius 0) grip notch on an ordinary outer wall cuts the free edge, contour stays simple', () => {
  const project = baseProject();
  project.pieceNotches = { 'wall-h-0-0': { enabled: true, widthMm: 30, depthMm: 10, offsetMm: 20, radiusMm: 0 } };
  const run = enumerateWallRuns(project.grid, project).find((r) => r.kind === 'h' && r.r === 0);
  const piece = buildWallPanel(run, project.grid, project, true);
  assert(isSimplePolygon(piece.outline), 'notched outline self-intersects');
  const floorPoints = piece.outline.filter((p) => p.x >= 20 - 1e-6 && p.x <= 50 + 1e-6 && Math.abs(p.y - 40) < 1e-6);
  assert(floorPoints.length === 2, `expected exactly 2 points at the notch floor, got ${floorPoints.length}`);
});

test('a rounded grip notch stays simple before and after burn correction, and the deepest point grows deeper (not shallower)', () => {
  const project = baseProject();
  project.pieceNotches = { 'wall-h-0-0': { enabled: true, widthMm: 30, depthMm: 15, offsetMm: 20, radiusMm: 15 } };
  const run = enumerateWallRuns(project.grid, project).find((r) => r.kind === 'h' && r.r === 0);
  const raw = buildWallPanel(run, project.grid, project, true);
  assert(isSimplePolygon(raw.outline), 'raw notched outline self-intersects');
  const corrected = burnCorrect(raw, project.burnMm);
  assert(isSimplePolygon(corrected.outline), 'burn-corrected notched outline self-intersects');

  const rawMinY = Math.min(...raw.outline.map((p) => p.y));
  const correctedMinY = Math.min(...corrected.outline.map((p) => p.y));
  assert(correctedMinY < rawMinY, `burn correction should dig the notch slightly deeper (${correctedMinY} should be < ${rawMinY}), not shallower — sign-flip regression check`);
});

test('no pieceNotches entry (or enabled:false) leaves every piece exactly as before', () => {
  const project = baseProject();
  const before = computePieces(project);
  project.pieceNotches = { 'wall-h-0-0': { ...DEFAULT_GRIP_NOTCH, enabled: false } };
  const after = computePieces(project);
  assert(before.length === after.length);
  for (let i = 0; i < before.length; i++) {
    assert(JSON.stringify(before[i].outline) === JSON.stringify(after[i].outline), `piece ${before[i].id} changed despite a disabled notch`);
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

  function tabPresentInRange(pieces) {
    const wall = pieces.find((p) => p.id === drawerPieceId);
    // Strictly ABOVE the un-notched height, not just >= it — a plain
    // boundary point at exactly outerHeightMm (the neighboring un-notched
    // segments' own edges) sits right at this range's endpoints too and
    // must not be mistaken for a genuinely protruding tab.
    return wall.outline.some((p) => p.x >= fingerSeg.start - 1e-6 && p.x <= fingerSeg.start + fingerSeg.length + 1e-6 && p.y > ctxBefore.sleeveProject.outerHeightMm + 1e-6);
  }

  const withoutNotch = buildDrawerBox(project.grid, project);
  assert(tabPresentInRange(withoutNotch), 'sanity check: the finger tab should be present without any notch');

  project.pieceNotches = {
    [drawerPieceId]: { enabled: true, widthMm: fingerSeg.length, depthMm: 5, offsetMm: fingerSeg.start, radiusMm: 0 },
  };
  const withNotch = buildDrawerBox(project.grid, project);
  assert(!tabPresentInRange(withNotch), 'the grip notch should have removed the finger tab in its own range');
  assert(isSimplePolygon(withNotch.find((p) => p.id === drawerPieceId).outline), 'notched drawer wall outline self-intersects');
});

// --- validation ---

test('validateGripNotch: rejects the expected cases, accepts a well-formed one', () => {
  const project = baseProject();
  const run = enumerateWallRuns(project.grid, project).find((r) => r.kind === 'h' && r.r === 0);

  assert(!validateGripNotch(run, project.grid, project, { enabled: true, widthMm: 30, depthMm: 10, offsetMm: -5, radiusMm: 0 }).ok, 'negative offset should be rejected');
  assert(!validateGripNotch(run, project.grid, project, { enabled: true, widthMm: 0, depthMm: 10, offsetMm: 10, radiusMm: 0 }).ok, 'zero width should be rejected');
  assert(!validateGripNotch(run, project.grid, project, { enabled: true, widthMm: 30, depthMm: 10, offsetMm: 10, radiusMm: 20 }).ok, 'radius beyond its own max should be rejected');
  assert(!validateGripNotch(run, project.grid, project, { enabled: true, widthMm: 30, depthMm: 10, offsetMm: 140, radiusMm: 0 }).ok, 'a notch extending past the run\'s own length should be rejected');
  assert(!validateGripNotch(run, project.grid, project, { enabled: true, widthMm: 30, depthMm: 55, offsetMm: 10, radiusMm: 0 }).ok, 'depth >= local height should be rejected');

  const ok = validateGripNotch(run, project.grid, project, { enabled: true, widthMm: 30, depthMm: 10, offsetMm: 20, radiusMm: 5 });
  assert(ok.ok, `expected a well-formed notch to validate, got problems: ${ok.problems.join('; ')}`);
});

test('validateGripNotch: rejects a notch overlapping a T-junction mortise', () => {
  const project = createDefaultProject();
  project.grid = createGrid([80, 80], [100]); // T junction: interior divider at c=1
  const run = enumerateWallRuns(project.grid, project).find((r) => r.kind === 'h' && r.r === 0);
  // The divider lands near the run's own midpoint (~83mm in) — place a wide notch straddling it.
  const overlapping = validateGripNotch(run, project.grid, project, { enabled: true, widthMm: 20, depthMm: 5, offsetMm: 75, radiusMm: 0 });
  assert(!overlapping.ok, 'a notch straddling the T-junction mortise should be rejected');
});

// --- PieceContext round-trip ---

test('resolveWallRunContext for a drawer piece resolves a run that rebuilds identically to buildDrawerBox\'s own output', () => {
  const project = baseProject();
  project.drawer = { enabled: true, playMm: 1, thicknessMm: 3, openSide: 'right' };
  project.pieceNotches = { [`${DRAWER_PREFIX}wall-h-0-0`]: { enabled: true, widthMm: 20, depthMm: 5, offsetMm: 10, radiusMm: 2 } };

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
