// NotchFrame: the coordinate mapping between a Notch's own canonical space
// (offsetMm/depthMm, the space Notch.movedBy/resizedToward already operate
// in — modeled on a wall's own free/top edge) and the piece's real (x,y) mm
// space, for every edge orientation a grip notch can actually sit on. Cross-
// checked against the SAME formulas Panel.js/FlatPanel.js use to build the
// real outline (alongX/alongY, nominalPointAt/inwardDirection), reproduced
// by hand here rather than imported, so a bug shared by both sides can't
// hide.
import { test, assert, assertClose, run } from './testHarness.js';
import { Notch } from '../geometry/oo/Notch.js';
import { frameCorners, frameToCanonical } from '../geometry/oo/NotchFrame.js';

const WALL_TOP = { axis: 'x', zeroBoundary: false }; // existing case: a wall's free/top edge
const WALL_A_END = { axis: 'y', zeroBoundary: true }; // a wall's own leftEdge-field END edge
const WALL_B_END = { axis: 'y', zeroBoundary: false }; // a wall's own rightEdge-field END edge
const FLAT_TOP = { axis: 'x', zeroBoundary: true };
const FLAT_BOTTOM = { axis: 'x', zeroBoundary: false };
const FLAT_LEFT = { axis: 'y', zeroBoundary: true };
const FLAT_RIGHT = { axis: 'y', zeroBoundary: false };

test('frameCorners: wall top edge (existing case) matches offsetMm/localHeightMm-depthMm directly', () => {
  const notch = new Notch({ widthMm: 30, depthMm: 10, offsetMm: 20, radiusMm: 0 });
  const boundaryMm = 50; // heightAt(...) at the notch's own center, in the real code
  const { anchor, free } = frameCorners(WALL_TOP, boundaryMm, notch);
  assertClose(anchor.x, 20); assertClose(anchor.y, 50);
  assertClose(free.x, 50); assertClose(free.y, 40);
});

test('frameCorners: a wall\'s own "a" end (leftEdge field) cuts inward from x=0, u along y', () => {
  const notch = new Notch({ widthMm: 30, depthMm: 10, offsetMm: 20, radiusMm: 0 });
  const { anchor, free } = frameCorners(WALL_A_END, 0, notch);
  assertClose(anchor.x, 0); assertClose(anchor.y, 20);
  assertClose(free.x, 10); assertClose(free.y, 50);
});

test('frameCorners: a wall\'s own "b" end (rightEdge field) cuts inward from x=run.length, u along y', () => {
  const notch = new Notch({ widthMm: 30, depthMm: 10, offsetMm: 20, radiusMm: 0 });
  const runLength = 80;
  const { anchor, free } = frameCorners(WALL_B_END, runLength, notch);
  assertClose(anchor.x, 80); assertClose(anchor.y, 20);
  assertClose(free.x, 70); assertClose(free.y, 50);
});

test('frameCorners: a flat panel\'s own top side cuts inward from y=0, u along x', () => {
  const notch = new Notch({ widthMm: 30, depthMm: 10, offsetMm: 20, radiusMm: 0 });
  const { anchor, free } = frameCorners(FLAT_TOP, 0, notch);
  assertClose(anchor.x, 20); assertClose(anchor.y, 0);
  assertClose(free.x, 50); assertClose(free.y, 10);
});

test('frameCorners: a flat panel\'s own bottom side cuts inward from y=depthMm, u along x', () => {
  const notch = new Notch({ widthMm: 30, depthMm: 10, offsetMm: 20, radiusMm: 0 });
  const panelDepthMm = 80;
  const { anchor, free } = frameCorners(FLAT_BOTTOM, panelDepthMm, notch);
  assertClose(anchor.x, 20); assertClose(anchor.y, 80);
  assertClose(free.x, 50); assertClose(free.y, 70);
});

test('frameCorners: a flat panel\'s own left side cuts inward from x=0, u along y', () => {
  const notch = new Notch({ widthMm: 30, depthMm: 10, offsetMm: 20, radiusMm: 0 });
  const { anchor, free } = frameCorners(FLAT_LEFT, 0, notch);
  assertClose(anchor.x, 0); assertClose(anchor.y, 20);
  assertClose(free.x, 10); assertClose(free.y, 50);
});

test('frameCorners: a flat panel\'s own right side cuts inward from x=widthMm, u along y', () => {
  const notch = new Notch({ widthMm: 30, depthMm: 10, offsetMm: 20, radiusMm: 0 });
  const panelWidthMm = 80;
  const { anchor, free } = frameCorners(FLAT_RIGHT, panelWidthMm, notch);
  assertClose(anchor.x, 80); assertClose(anchor.y, 20);
  assertClose(free.x, 70); assertClose(free.y, 50);
});

test('frameToCanonical: round-trips frameCorners for every orientation — moving the free corner by dU/dDepth reproduces the same offsetMm/widthMm/depthMm', () => {
  const frames = [
    { frame: WALL_TOP, boundaryMm: 50 },
    { frame: WALL_A_END, boundaryMm: 0 },
    { frame: WALL_B_END, boundaryMm: 80 },
    { frame: FLAT_TOP, boundaryMm: 0 },
    { frame: FLAT_BOTTOM, boundaryMm: 80 },
    { frame: FLAT_LEFT, boundaryMm: 0 },
    { frame: FLAT_RIGHT, boundaryMm: 80 },
  ];
  for (const { frame, boundaryMm } of frames) {
    const notch = new Notch({ widthMm: 30, depthMm: 10, offsetMm: 20, radiusMm: 0 });
    const { anchor, free } = frameCorners(frame, boundaryMm, notch);

    const anchorCanon = frameToCanonical(frame, boundaryMm, anchor.x, anchor.y);
    assertClose(anchorCanon.x, notch.offsetMm, 1e-9, `${frame.axis}/${frame.zeroBoundary}: anchor canonical x`);
    assertClose(anchorCanon.localHeightMm, frame.zeroBoundary ? 0 : boundaryMm, 1e-9, `${frame.axis}/${frame.zeroBoundary}: localHeightMm`);
    assertClose(anchorCanon.localHeightMm - anchorCanon.y, 0, 1e-9, `${frame.axis}/${frame.zeroBoundary}: anchor has zero depth`);

    const freeCanon = frameToCanonical(frame, boundaryMm, free.x, free.y);
    assertClose(freeCanon.x, notch.offsetMm + notch.widthMm, 1e-9, `${frame.axis}/${frame.zeroBoundary}: free canonical x`);
    assertClose(freeCanon.localHeightMm - freeCanon.y, notch.depthMm, 1e-9, `${frame.axis}/${frame.zeroBoundary}: free corner reproduces depthMm`);

    const resized = notch.resizedToward({ x: freeCanon.x, y: freeCanon.y }, 1, freeCanon.localHeightMm);
    assertClose(resized.widthMm, notch.widthMm, 1e-9, `${frame.axis}/${frame.zeroBoundary}: resizedToward reproduces widthMm`);
    assertClose(resized.depthMm, notch.depthMm, 1e-9, `${frame.axis}/${frame.zeroBoundary}: resizedToward reproduces depthMm`);
  }
});

run();
