// FlatPanel: a Panel (see ooPanel.test.js) whose outline() is overridden to
// fuse adjacent sides' corners instead of trusting each edge's own tip —
// see FlatPanel.js's own header for why that's a genuinely different
// algorithm from Panel's wall-mode one, not a rename.
//
// The equivalence tests below were originally verified live against
// OuterBoundary.outerBoundaryOutline (the pre-existing implementation this
// ports, now deleted) — once equivalence was confirmed and Assembly.js was
// switched over to build real FlatPanel instances, the expected outlines
// were frozen here as plain fixture values instead of keeping that
// duplicate algorithm alive forever just to serve as a permanent oracle.
import { test, assert, run } from './testHarness.js';
import { FlatPanel } from '../geometry/oo/FlatPanel.js';
import { SmoothEdge } from '../geometry/oo/SmoothEdge.js';
import { FingerEdge } from '../geometry/oo/FingerEdge.js';
import { outerBoundarySide } from '../geometry/oo/OuterBoundary.js';

test('FlatPanel(): with all 4 sides present matches the known-correct outline, via the compass->field table (top->bottomEdge, bottom->topEdge)', () => {
  const widthMm = 100, depthMm = 80, marginMm = 3;
  const fingerJoint = { fingerMm: 20, spaceMm: 20, marginMm: 5 };

  const topEdgeCfg = new FingerEdge(outerBoundarySide({ lengthMm: widthMm, fingerJoint, startWithFinger: false, marginMm, protrude: false }));
  const rightEdgeCfg = new FingerEdge(outerBoundarySide({ lengthMm: depthMm, fingerJoint, startWithFinger: true, marginMm, protrude: false }));
  const bottomEdgeCfg = new FingerEdge(outerBoundarySide({ lengthMm: widthMm, fingerJoint, startWithFinger: false, marginMm, protrude: false }));
  const leftEdgeCfg = new FingerEdge(outerBoundarySide({ lengthMm: depthMm, fingerJoint, startWithFinger: true, marginMm, protrude: false }));

  const flatPanel = new FlatPanel({
    id: 'base-plate', kind: 'basePlate', thicknessMm: 3,
    bottomEdge: topEdgeCfg, rightEdge: rightEdgeCfg, topEdge: bottomEdgeCfg, leftEdge: leftEdgeCfg,
    widthMm, depthMm, marginMm, protrude: false, openSides: { top: false, right: false, bottom: false, left: false },
  });

  // Frozen from this exact scenario, verified live against the (now-deleted)
  // OuterBoundary.outerBoundaryOutline before this refactor removed it.
  const expected = [{ x: 20, y: -3 }, { x: 40, y: -3 }, { x: 40, y: 0 }, { x: 60, y: 0 }, { x: 60, y: -3 }, { x: 80, y: -3 }, { x: 103, y: -3 }, { x: 103, y: 10 }, { x: 100, y: 10 }, { x: 100, y: 30 }, { x: 103, y: 30 }, { x: 103, y: 50 }, { x: 100, y: 50 }, { x: 100, y: 70 }, { x: 103, y: 70 }, { x: 103, y: 83 }, { x: 80, y: 83 }, { x: 60, y: 83 }, { x: 60, y: 80 }, { x: 40, y: 80 }, { x: 40, y: 83 }, { x: 20, y: 83 }, { x: -3, y: 83 }, { x: -3, y: 70 }, { x: 0, y: 70 }, { x: 0, y: 50 }, { x: -3, y: 50 }, { x: -3, y: 30 }, { x: 0, y: 30 }, { x: 0, y: 10 }, { x: -3, y: 10 }, { x: -3, y: -3 }];

  assert(JSON.stringify(flatPanel.outline()) === JSON.stringify(expected), `expected FlatPanel's outline to match the frozen fixture, got ${JSON.stringify(flatPanel.outline())}`);
});

test('FlatPanel(): thicknessGroup is always \'outer\', regardless of what is passed', () => {
  const widthMm = 10, depthMm = 10, marginMm = 3;
  const flatPanel = new FlatPanel({
    id: 'lid', kind: 'lid', thicknessMm: 3,
    bottomEdge: new SmoothEdge({ lengthMm: 10, heightProfile: [{ uStart: 0, uEnd: 10, height: 0 }] }),
    rightEdge: new SmoothEdge({ lengthMm: 10, heightProfile: [{ uStart: 0, uEnd: 10, height: 0 }] }),
    topEdge: new SmoothEdge({ lengthMm: 10, heightProfile: [{ uStart: 0, uEnd: 10, height: 0 }] }),
    leftEdge: new SmoothEdge({ lengthMm: 10, heightProfile: [{ uStart: 0, uEnd: 10, height: 0 }] }),
    widthMm, depthMm, marginMm, protrude: false, openSides: { top: false, right: false, bottom: false, left: false },
  });
  assert(flatPanel.thicknessGroup === 'outer', `expected thicknessGroup to always be 'outer', got ${flatPanel.thicknessGroup}`);
});

test('FlatPanel(): with openSides.right=true reproduces the exact same corner geometry as the old null/open-side handling — no accidental shift', () => {
  const widthMm = 100, depthMm = 80, marginMm = 3;
  const fingerJoint = { fingerMm: 20, spaceMm: 20, marginMm: 5 };

  const topEdgeCfg = new FingerEdge(outerBoundarySide({ lengthMm: widthMm, fingerJoint, startWithFinger: false, marginMm, protrude: false }));
  const rightEdgeCfg = new SmoothEdge({ lengthMm: depthMm, heightProfile: [{ uStart: 0, uEnd: depthMm, height: 0 }] });
  const bottomEdgeCfg = new FingerEdge(outerBoundarySide({ lengthMm: widthMm, fingerJoint, startWithFinger: false, marginMm, protrude: false }));
  const leftEdgeCfg = new FingerEdge(outerBoundarySide({ lengthMm: depthMm, fingerJoint, startWithFinger: true, marginMm, protrude: false }));

  const flatPanel = new FlatPanel({
    id: 'base-plate', kind: 'basePlate', thicknessMm: 3,
    bottomEdge: topEdgeCfg, rightEdge: rightEdgeCfg, topEdge: bottomEdgeCfg, leftEdge: leftEdgeCfg,
    widthMm, depthMm, marginMm, protrude: false, openSides: { top: false, right: true, bottom: false, left: false },
  });

  // Frozen from this exact scenario, verified live against the (now-deleted)
  // OuterBoundary.outerBoundaryOutline before this refactor removed it —
  // the right side stays flush at the nominal width (x=100), no margin.
  const expected = [{ x: 20, y: -3 }, { x: 40, y: -3 }, { x: 40, y: 0 }, { x: 60, y: 0 }, { x: 60, y: -3 }, { x: 80, y: -3 }, { x: 100, y: -3 }, { x: 100, y: 83 }, { x: 80, y: 83 }, { x: 60, y: 83 }, { x: 60, y: 80 }, { x: 40, y: 80 }, { x: 40, y: 83 }, { x: 20, y: 83 }, { x: -3, y: 83 }, { x: -3, y: 70 }, { x: 0, y: 70 }, { x: 0, y: 50 }, { x: -3, y: 50 }, { x: -3, y: 30 }, { x: 0, y: 30 }, { x: 0, y: 10 }, { x: -3, y: 10 }, { x: -3, y: -3 }];

  assert(JSON.stringify(flatPanel.outline()) === JSON.stringify(expected), `expected the open-right-side outline to match the frozen fixture, got ${JSON.stringify(flatPanel.outline())}`);
});

test('FlatPanel(): a grip notch on an open right side cuts INTO the panel (x decreases below the nominal width), not outward — the inward vector for an open side must be the flip of a real one, never derived from edge===null', () => {
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

  const flatPanel = new FlatPanel({
    id: 'base-plate', kind: 'basePlate', thicknessMm: 3,
    bottomEdge: topEdgeCfg, rightEdge: rightEdgeCfg, topEdge: bottomEdgeCfg, leftEdge: leftEdgeCfg,
    widthMm, depthMm, marginMm, protrude: false, openSides: { top: false, right: true, bottom: false, left: false },
  });

  const outline = flatPanel.outline();
  const nearPoint = (target) => outline.some((p) => Math.abs(p.x - target.x) < 1e-6 && Math.abs(p.y - target.y) < 1e-6);
  assert(nearPoint({ x: widthMm - 8, y: 30 }), `expected the outline to dip INTO the panel (x=${widthMm - 8}) at the notch's own start (y=30), got ${JSON.stringify(outline)}`);
  assert(nearPoint({ x: widthMm - 8, y: 50 }), `expected the outline to dip INTO the panel (x=${widthMm - 8}) at the notch's own end (y=50), got ${JSON.stringify(outline)}`);
  assert(!nearPoint({ x: widthMm + 8, y: 30 }), 'the notch must never cut OUTWARD past the nominal width');
});

test('FlatPanel(): with protrude=true (recessed lid) matches the known-correct outline, no special-casing needed', () => {
  const widthMm = 100, depthMm = 80, marginMm = 3;
  const fingerJoint = { fingerMm: 20, spaceMm: 20, marginMm: 5 };

  const topEdgeCfg = new FingerEdge(outerBoundarySide({ lengthMm: widthMm, fingerJoint, startWithFinger: false, marginMm, protrude: true }));
  const rightEdgeCfg = new FingerEdge(outerBoundarySide({ lengthMm: depthMm, fingerJoint, startWithFinger: true, marginMm, protrude: true }));
  const bottomEdgeCfg = new FingerEdge(outerBoundarySide({ lengthMm: widthMm, fingerJoint, startWithFinger: false, marginMm, protrude: true }));
  const leftEdgeCfg = new FingerEdge(outerBoundarySide({ lengthMm: depthMm, fingerJoint, startWithFinger: true, marginMm, protrude: true }));

  const flatPanel = new FlatPanel({
    id: 'lid', kind: 'lid', thicknessMm: 3,
    bottomEdge: topEdgeCfg, rightEdge: rightEdgeCfg, topEdge: bottomEdgeCfg, leftEdge: leftEdgeCfg,
    widthMm, depthMm, marginMm, protrude: true, openSides: { top: false, right: false, bottom: false, left: false },
  });

  // Frozen from this exact scenario, verified live against the (now-deleted)
  // OuterBoundary.outerBoundaryOutline before this refactor removed it —
  // margin is 0 on every side here (protrude:true), tabs poke INWARD instead.
  const expected = [{ x: 20, y: 0 }, { x: 40, y: 0 }, { x: 40, y: -3 }, { x: 60, y: -3 }, { x: 60, y: 0 }, { x: 80, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 10 }, { x: 103, y: 10 }, { x: 103, y: 30 }, { x: 100, y: 30 }, { x: 100, y: 50 }, { x: 103, y: 50 }, { x: 103, y: 70 }, { x: 100, y: 70 }, { x: 100, y: 80 }, { x: 80, y: 80 }, { x: 60, y: 80 }, { x: 60, y: 83 }, { x: 40, y: 83 }, { x: 40, y: 80 }, { x: 20, y: 80 }, { x: 0, y: 80 }, { x: 0, y: 70 }, { x: -3, y: 70 }, { x: -3, y: 50 }, { x: 0, y: 50 }, { x: 0, y: 30 }, { x: -3, y: 30 }, { x: -3, y: 10 }, { x: 0, y: 10 }, { x: 0, y: 0 }];

  assert(JSON.stringify(flatPanel.outline()) === JSON.stringify(expected), `expected the protrude:true outline to match the frozen fixture, got ${JSON.stringify(flatPanel.outline())}`);
});

run();
