// FlatPanel: a Panel (see ooPanel.test.js) whose outline() is overridden to
// fuse adjacent sides' corners instead of trusting each edge's own tip —
// see FlatPanel.js's own header for why that's a genuinely different
// algorithm from Panel's wall-mode one, not a rename. These tests verify
// that algorithm directly against OuterBoundary.outerBoundaryOutline (the
// pre-existing implementation this ports) before Assembly.js is switched
// over to build FlatPanel instances for real.
import { test, assert, run } from './testHarness.js';
import { FlatPanel } from '../geometry/oo/FlatPanel.js';
import { SmoothEdge } from '../geometry/oo/SmoothEdge.js';
import { FingerEdge } from '../geometry/oo/FingerEdge.js';
import { outerBoundarySide, outerBoundaryOutline } from '../geometry/oo/OuterBoundary.js';

test('FlatPanel(): with all 4 sides present matches outerBoundaryOutline for the same geometry, via the compass->field table (top->bottomEdge, bottom->topEdge)', () => {
  const widthMm = 100, depthMm = 80, marginMm = 3;
  const fingerJoint = { fingerMm: 20, spaceMm: 20, marginMm: 5 };

  const topEdgeCfg = new FingerEdge(outerBoundarySide({ lengthMm: widthMm, fingerJoint, startWithFinger: false, marginMm, protrude: false }));
  const rightEdgeCfg = new FingerEdge(outerBoundarySide({ lengthMm: depthMm, fingerJoint, startWithFinger: true, marginMm, protrude: false }));
  const bottomEdgeCfg = new FingerEdge(outerBoundarySide({ lengthMm: widthMm, fingerJoint, startWithFinger: false, marginMm, protrude: false }));
  const leftEdgeCfg = new FingerEdge(outerBoundarySide({ lengthMm: depthMm, fingerJoint, startWithFinger: true, marginMm, protrude: false }));

  const sides = {
    top: { edge: topEdgeCfg, axisPoint: (u) => ({ x: u, y: 0 }), inward: { x: 0, y: 1 } },
    right: { edge: rightEdgeCfg, axisPoint: (u) => ({ x: widthMm, y: u }), inward: { x: -1, y: 0 } },
    bottom: { edge: bottomEdgeCfg, axisPoint: (u) => ({ x: u, y: depthMm }), inward: { x: 0, y: -1 } },
    left: { edge: leftEdgeCfg, axisPoint: (u) => ({ x: 0, y: u }), inward: { x: 1, y: 0 } },
  };
  const margins = { top: marginMm, right: marginMm, bottom: marginMm, left: marginMm };
  const oracle = outerBoundaryOutline(sides, widthMm, depthMm, margins);

  const flatPanel = new FlatPanel({
    id: 'base-plate', kind: 'basePlate', thicknessMm: 3,
    bottomEdge: topEdgeCfg, rightEdge: rightEdgeCfg, topEdge: bottomEdgeCfg, leftEdge: leftEdgeCfg,
    widthMm, depthMm, marginMm, protrude: false, openSides: { top: false, right: false, bottom: false, left: false },
  });

  assert(JSON.stringify(flatPanel.outline()) === JSON.stringify(oracle), `expected FlatPanel's outline to match outerBoundaryOutline exactly, got ${JSON.stringify(flatPanel.outline())} vs oracle ${JSON.stringify(oracle)}`);
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

  const sides = {
    top: { edge: topEdgeCfg, axisPoint: (u) => ({ x: u, y: 0 }), inward: { x: 0, y: 1 } },
    right: { edge: rightEdgeCfg, axisPoint: (u) => ({ x: widthMm, y: u }), inward: { x: 1, y: 0 } }, // flipped inward: open side
    bottom: { edge: bottomEdgeCfg, axisPoint: (u) => ({ x: u, y: depthMm }), inward: { x: 0, y: -1 } },
    left: { edge: leftEdgeCfg, axisPoint: (u) => ({ x: 0, y: u }), inward: { x: 1, y: 0 } },
  };
  const margins = { top: marginMm, right: 0, bottom: marginMm, left: marginMm };
  const oracle = outerBoundaryOutline(sides, widthMm, depthMm, margins);

  const flatPanel = new FlatPanel({
    id: 'base-plate', kind: 'basePlate', thicknessMm: 3,
    bottomEdge: topEdgeCfg, rightEdge: rightEdgeCfg, topEdge: bottomEdgeCfg, leftEdge: leftEdgeCfg,
    widthMm, depthMm, marginMm, protrude: false, openSides: { top: false, right: true, bottom: false, left: false },
  });

  assert(JSON.stringify(flatPanel.outline()) === JSON.stringify(oracle), `expected the open-right-side outline to match the oracle exactly, got ${JSON.stringify(flatPanel.outline())} vs oracle ${JSON.stringify(oracle)}`);
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

test('FlatPanel(): with protrude=true (recessed lid) matches outerBoundaryOutline for the same geometry, no special-casing needed', () => {
  const widthMm = 100, depthMm = 80, marginMm = 3;
  const fingerJoint = { fingerMm: 20, spaceMm: 20, marginMm: 5 };

  const topEdgeCfg = new FingerEdge(outerBoundarySide({ lengthMm: widthMm, fingerJoint, startWithFinger: false, marginMm, protrude: true }));
  const rightEdgeCfg = new FingerEdge(outerBoundarySide({ lengthMm: depthMm, fingerJoint, startWithFinger: true, marginMm, protrude: true }));
  const bottomEdgeCfg = new FingerEdge(outerBoundarySide({ lengthMm: widthMm, fingerJoint, startWithFinger: false, marginMm, protrude: true }));
  const leftEdgeCfg = new FingerEdge(outerBoundarySide({ lengthMm: depthMm, fingerJoint, startWithFinger: true, marginMm, protrude: true }));

  const sign = -1; // protrude:true
  const sides = {
    top: { edge: topEdgeCfg, axisPoint: (u) => ({ x: u, y: 0 }), inward: { x: 0, y: sign } },
    right: { edge: rightEdgeCfg, axisPoint: (u) => ({ x: widthMm, y: u }), inward: { x: -sign, y: 0 } },
    bottom: { edge: bottomEdgeCfg, axisPoint: (u) => ({ x: u, y: depthMm }), inward: { x: 0, y: -sign } },
    left: { edge: leftEdgeCfg, axisPoint: (u) => ({ x: 0, y: u }), inward: { x: sign, y: 0 } },
  };
  // protrude:true => margin is 0 on every side (see FlatPanel.outline: `protrude ? 0 : marginMm`).
  const margins = { top: 0, right: 0, bottom: 0, left: 0 };
  const oracle = outerBoundaryOutline(sides, widthMm, depthMm, margins);

  const flatPanel = new FlatPanel({
    id: 'lid', kind: 'lid', thicknessMm: 3,
    bottomEdge: topEdgeCfg, rightEdge: rightEdgeCfg, topEdge: bottomEdgeCfg, leftEdge: leftEdgeCfg,
    widthMm, depthMm, marginMm, protrude: true, openSides: { top: false, right: false, bottom: false, left: false },
  });

  assert(JSON.stringify(flatPanel.outline()) === JSON.stringify(oracle), `expected the protrude:true outline to match the oracle exactly, got ${JSON.stringify(flatPanel.outline())} vs oracle ${JSON.stringify(oracle)}`);
});

run();
