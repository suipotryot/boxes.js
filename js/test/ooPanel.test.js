// Panel: assembles 4 Edge instances into one closed contour, and flattens
// via toPiece() into the exact {id,kind,thicknessGroup,thicknessMm,
// outline,holes} shape existing downstream code (BurnCorrection, the UI,
// export) already expects — the contract this whole refactor promised not
// to change. Equivalence against the old buildWallPanel was verified
// extensively during migration (see js/test/ooEquivalence.test.js's own
// history); once the old pipeline was deleted at cutover, that comparison
// lost its oracle and was retired along with it.
//
// The flat-mode (boundary) tests below were originally verified live
// against OuterBoundary.outerBoundaryOutline (the now-deleted duplicate
// algorithm this unification replaced) — once equivalence was confirmed,
// the expected outlines were frozen here as plain fixture values instead
// of keeping that duplicate algorithm alive forever just to serve as a
// permanent oracle.
import { test, assert, run } from './testHarness.js';
import { Panel } from '../geometry/oo/Panel.js';
import { SmoothEdge } from '../geometry/oo/SmoothEdge.js';
import { FingerEdge } from '../geometry/oo/FingerEdge.js';
import { outerBoundarySide } from '../geometry/oo/OuterBoundary.js';

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

test('Panel(): boundary defaults to null (wall mode) when not given', () => {
  const bottomEdge = new FingerEdge({ lengthMm: 100, fingerJoint: { fingerMm: 20, spaceMm: 20, marginMm: 5 }, startWithFinger: true, mateThicknessMm: 3, baselineMm: 0, signMm: -1 });
  const rightEdge = new FingerEdge({ lengthMm: 40, fingerJoint: { fingerMm: 20, spaceMm: 20, marginMm: 5 }, startWithFinger: true, mateThicknessMm: 3, extendToTips: true, baselineMm: 100, signMm: 1 });
  const topEdge = new SmoothEdge({ lengthMm: 100, heightProfile: [{ uStart: 0, uEnd: 100, height: 40 }] });
  const leftEdge = new FingerEdge({ lengthMm: 40, fingerJoint: { fingerMm: 20, spaceMm: 20, marginMm: 5 }, startWithFinger: true, mateThicknessMm: 3, extendToTips: true, baselineMm: 0, signMm: -1 });
  const panel = new Panel({ id: 'wall-h-0-0', kind: 'wall', thicknessGroup: 'outer', thicknessMm: 3, bottomEdge, rightEdge, topEdge, leftEdge });

  assert(panel.boundary === null, `expected boundary to default to null (wall mode), got ${JSON.stringify(panel.boundary)}`);
});

test('Panel(): flat mode (boundary set, all 4 sides present) matches the known-correct outline, via the compass->field table (top->bottomEdge, bottom->topEdge)', () => {
  const widthMm = 100, depthMm = 80, marginMm = 3;
  const fingerJoint = { fingerMm: 20, spaceMm: 20, marginMm: 5 };

  const topEdgeCfg = new FingerEdge(outerBoundarySide({ lengthMm: widthMm, fingerJoint, startWithFinger: false, marginMm, protrude: false }));
  const rightEdgeCfg = new FingerEdge(outerBoundarySide({ lengthMm: depthMm, fingerJoint, startWithFinger: true, marginMm, protrude: false }));
  const bottomEdgeCfg = new FingerEdge(outerBoundarySide({ lengthMm: widthMm, fingerJoint, startWithFinger: false, marginMm, protrude: false }));
  const leftEdgeCfg = new FingerEdge(outerBoundarySide({ lengthMm: depthMm, fingerJoint, startWithFinger: true, marginMm, protrude: false }));

  const panel = new Panel({
    id: 'base-plate', kind: 'basePlate', thicknessGroup: 'outer', thicknessMm: 3,
    bottomEdge: topEdgeCfg, rightEdge: rightEdgeCfg, topEdge: bottomEdgeCfg, leftEdge: leftEdgeCfg,
    boundary: { widthMm, depthMm, marginMm, protrude: false, openSides: { top: false, right: false, bottom: false, left: false } },
  });

  // Frozen from this exact scenario, verified live against the (now-deleted)
  // OuterBoundary.outerBoundaryOutline before this refactor removed it.
  const expected = [{ x: 20, y: -3 }, { x: 40, y: -3 }, { x: 40, y: 0 }, { x: 60, y: 0 }, { x: 60, y: -3 }, { x: 80, y: -3 }, { x: 103, y: -3 }, { x: 103, y: 10 }, { x: 100, y: 10 }, { x: 100, y: 30 }, { x: 103, y: 30 }, { x: 103, y: 50 }, { x: 100, y: 50 }, { x: 100, y: 70 }, { x: 103, y: 70 }, { x: 103, y: 83 }, { x: 80, y: 83 }, { x: 60, y: 83 }, { x: 60, y: 80 }, { x: 40, y: 80 }, { x: 40, y: 83 }, { x: 20, y: 83 }, { x: -3, y: 83 }, { x: -3, y: 70 }, { x: 0, y: 70 }, { x: 0, y: 50 }, { x: -3, y: 50 }, { x: -3, y: 30 }, { x: 0, y: 30 }, { x: 0, y: 10 }, { x: -3, y: 10 }, { x: -3, y: -3 }];

  assert(JSON.stringify(panel.outline()) === JSON.stringify(expected), `expected the flat-mode outline to match the frozen fixture, got ${JSON.stringify(panel.outline())}`);
});

test('Panel(): flat mode with openSides.right=true reproduces the exact same corner geometry as the old null/open-side handling — no accidental shift', () => {
  const widthMm = 100, depthMm = 80, marginMm = 3;
  const fingerJoint = { fingerMm: 20, spaceMm: 20, marginMm: 5 };

  const topEdgeCfg = new FingerEdge(outerBoundarySide({ lengthMm: widthMm, fingerJoint, startWithFinger: false, marginMm, protrude: false }));
  const rightEdgeCfg = new SmoothEdge({ lengthMm: depthMm, heightProfile: [{ uStart: 0, uEnd: depthMm, height: 0 }] });
  const bottomEdgeCfg = new FingerEdge(outerBoundarySide({ lengthMm: widthMm, fingerJoint, startWithFinger: false, marginMm, protrude: false }));
  const leftEdgeCfg = new FingerEdge(outerBoundarySide({ lengthMm: depthMm, fingerJoint, startWithFinger: true, marginMm, protrude: false }));

  const panel = new Panel({
    id: 'base-plate', kind: 'basePlate', thicknessGroup: 'outer', thicknessMm: 3,
    bottomEdge: topEdgeCfg, rightEdge: rightEdgeCfg, topEdge: bottomEdgeCfg, leftEdge: leftEdgeCfg,
    boundary: { widthMm, depthMm, marginMm, protrude: false, openSides: { top: false, right: true, bottom: false, left: false } },
  });

  // Frozen from this exact scenario, verified live against the (now-deleted)
  // OuterBoundary.outerBoundaryOutline before this refactor removed it —
  // the right side stays flush at the nominal width (x=100), no margin.
  const expected = [{ x: 20, y: -3 }, { x: 40, y: -3 }, { x: 40, y: 0 }, { x: 60, y: 0 }, { x: 60, y: -3 }, { x: 80, y: -3 }, { x: 100, y: -3 }, { x: 100, y: 83 }, { x: 80, y: 83 }, { x: 60, y: 83 }, { x: 60, y: 80 }, { x: 40, y: 80 }, { x: 40, y: 83 }, { x: 20, y: 83 }, { x: -3, y: 83 }, { x: -3, y: 70 }, { x: 0, y: 70 }, { x: 0, y: 50 }, { x: -3, y: 50 }, { x: -3, y: 30 }, { x: 0, y: 30 }, { x: 0, y: 10 }, { x: -3, y: 10 }, { x: -3, y: -3 }];

  assert(JSON.stringify(panel.outline()) === JSON.stringify(expected), `expected the open-right-side outline to match the frozen fixture, got ${JSON.stringify(panel.outline())}`);
});

test('Panel(): a grip notch on an open right side cuts INTO the panel (x decreases below the nominal width), not outward — the inward vector for an open side must be the flip of a real one, never derived from edge===null', () => {
  const widthMm = 100, depthMm = 80, marginMm = 3;
  const fingerJoint = { fingerMm: 20, spaceMm: 20, marginMm: 5 };
  // depth is NEGATIVE (0 - depthMm), matching Assembly.js's own flatGripFragments
  // (Notch.toEdgeFragment(0)) — the open side's flipped inward vector is what
  // turns this negative value back into a cut INTO the panel (see sidePoints).
  const notchFragment = { uStart: 30, uEnd: 50, depth: -8 };

  const topEdgeCfg = new FingerEdge(outerBoundarySide({ lengthMm: widthMm, fingerJoint, startWithFinger: false, marginMm, protrude: false }));
  const rightEdgeCfg = new SmoothEdge({ lengthMm: depthMm, heightProfile: [{ uStart: 0, uEnd: depthMm, height: 0 }], fragments: [notchFragment] });
  const bottomEdgeCfg = new FingerEdge(outerBoundarySide({ lengthMm: widthMm, fingerJoint, startWithFinger: false, marginMm, protrude: false }));
  const leftEdgeCfg = new FingerEdge(outerBoundarySide({ lengthMm: depthMm, fingerJoint, startWithFinger: true, marginMm, protrude: false }));

  const panel = new Panel({
    id: 'base-plate', kind: 'basePlate', thicknessGroup: 'outer', thicknessMm: 3,
    bottomEdge: topEdgeCfg, rightEdge: rightEdgeCfg, topEdge: bottomEdgeCfg, leftEdge: leftEdgeCfg,
    boundary: { widthMm, depthMm, marginMm, protrude: false, openSides: { top: false, right: true, bottom: false, left: false } },
  });

  const outline = panel.outline();
  const nearPoint = (target) => outline.some((p) => Math.abs(p.x - target.x) < 1e-6 && Math.abs(p.y - target.y) < 1e-6);
  assert(nearPoint({ x: widthMm - 8, y: 30 }), `expected the outline to dip INTO the panel (x=${widthMm - 8}) at the notch's own start (y=30), got ${JSON.stringify(outline)}`);
  assert(nearPoint({ x: widthMm - 8, y: 50 }), `expected the outline to dip INTO the panel (x=${widthMm - 8}) at the notch's own end (y=50), got ${JSON.stringify(outline)}`);
  assert(!nearPoint({ x: widthMm + 8, y: 30 }), 'the notch must never cut OUTWARD past the nominal width');
});

test('Panel(): flat mode with protrude=true (recessed lid) matches the known-correct outline, no special-casing needed', () => {
  const widthMm = 100, depthMm = 80, marginMm = 3;
  const fingerJoint = { fingerMm: 20, spaceMm: 20, marginMm: 5 };

  const topEdgeCfg = new FingerEdge(outerBoundarySide({ lengthMm: widthMm, fingerJoint, startWithFinger: false, marginMm, protrude: true }));
  const rightEdgeCfg = new FingerEdge(outerBoundarySide({ lengthMm: depthMm, fingerJoint, startWithFinger: true, marginMm, protrude: true }));
  const bottomEdgeCfg = new FingerEdge(outerBoundarySide({ lengthMm: widthMm, fingerJoint, startWithFinger: false, marginMm, protrude: true }));
  const leftEdgeCfg = new FingerEdge(outerBoundarySide({ lengthMm: depthMm, fingerJoint, startWithFinger: true, marginMm, protrude: true }));

  const panel = new Panel({
    id: 'lid', kind: 'lid', thicknessGroup: 'outer', thicknessMm: 3,
    bottomEdge: topEdgeCfg, rightEdge: rightEdgeCfg, topEdge: bottomEdgeCfg, leftEdge: leftEdgeCfg,
    boundary: { widthMm, depthMm, marginMm, protrude: true, openSides: { top: false, right: false, bottom: false, left: false } },
  });

  // Frozen from this exact scenario, verified live against the (now-deleted)
  // OuterBoundary.outerBoundaryOutline before this refactor removed it —
  // margin is 0 on every side here (protrude:true), tabs poke INWARD instead.
  const expected = [{ x: 20, y: 0 }, { x: 40, y: 0 }, { x: 40, y: -3 }, { x: 60, y: -3 }, { x: 60, y: 0 }, { x: 80, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 10 }, { x: 103, y: 10 }, { x: 103, y: 30 }, { x: 100, y: 30 }, { x: 100, y: 50 }, { x: 103, y: 50 }, { x: 103, y: 70 }, { x: 100, y: 70 }, { x: 100, y: 80 }, { x: 80, y: 80 }, { x: 60, y: 80 }, { x: 60, y: 83 }, { x: 40, y: 83 }, { x: 40, y: 80 }, { x: 20, y: 80 }, { x: 0, y: 80 }, { x: 0, y: 70 }, { x: -3, y: 70 }, { x: -3, y: 50 }, { x: 0, y: 50 }, { x: 0, y: 30 }, { x: -3, y: 30 }, { x: -3, y: 10 }, { x: 0, y: 10 }, { x: 0, y: 0 }];

  assert(JSON.stringify(panel.outline()) === JSON.stringify(expected), `expected the protrude:true outline to match the frozen fixture, got ${JSON.stringify(panel.outline())}`);
});

test('Panel(): wall mode tolerates a null side edge without throwing — the side is simply omitted from the assembled polygon', () => {
  const bottomEdge = new FingerEdge({ lengthMm: 100, fingerJoint: { fingerMm: 20, spaceMm: 20, marginMm: 5 }, startWithFinger: true, mateThicknessMm: 3, baselineMm: 0, signMm: -1 });
  const rightEdge = new FingerEdge({ lengthMm: 40, fingerJoint: { fingerMm: 20, spaceMm: 20, marginMm: 5 }, startWithFinger: true, mateThicknessMm: 3, extendToTips: true, baselineMm: 100, signMm: 1 });
  const leftEdge = new FingerEdge({ lengthMm: 40, fingerJoint: { fingerMm: 20, spaceMm: 20, marginMm: 5 }, startWithFinger: true, mateThicknessMm: 3, extendToTips: true, baselineMm: 0, signMm: -1 });
  const panel = new Panel({ id: 'wall-h-0-0', kind: 'wall', thicknessGroup: 'outer', thicknessMm: 3, bottomEdge, rightEdge, topEdge: null, leftEdge });

  const outline = panel.outline();
  assert(Array.isArray(outline), `expected outline() not to throw with topEdge=null, got ${outline}`);
});

run();
