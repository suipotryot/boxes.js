// PanelExtrude3D turns a flat 2D outline (piece.outline, straight-line
// segments only — confirmed nowhere in this codebase produces an arc or
// bezier, see SvgPath.js's own subpath()) plus a material thickness into
// plain local-space front/back/side face data, ready for a 3D adapter to
// place in world space (PiecePlacement3D.js) and hand to a renderer.
// Deliberately placement-agnostic — never touches grid/project — so it's
// testable with a bare fabricated outline.
import { test, assert, assertClose, run } from './testHarness.js';
import { extrudeOutline3D } from '../geometry/PanelExtrude3D.js';

function assertVec(actual, expected, msg) {
  assertClose(actual.x, expected.x, 1e-9, `${msg} (x)`);
  assertClose(actual.y, expected.y, 1e-9, `${msg} (y)`);
  assertClose(actual.z, expected.z, 1e-9, `${msg} (z)`);
}

test('a unit square outline extrudes into a front/back pair at z=0/z=thickness, verbatim in x/y', () => {
  const outline = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
  const { front, back } = extrudeOutline3D(outline, 2);
  assert(front.length === 4 && back.length === 4, 'front/back should have one point per outline vertex');
  outline.forEach((p, i) => {
    assertVec(front[i], { x: p.x, y: p.y, z: 0 }, `front[${i}]`);
    assertVec(back[i], { x: p.x, y: p.y, z: 2 }, `back[${i}]`);
  });
});

test('a unit square outline produces 4 side quads, each bridging one outline edge between front and back', () => {
  const outline = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
  const { front, back, sides } = extrudeOutline3D(outline, 2);
  assert(sides.length === 4, `expected 4 side quads, got ${sides.length}`);
  assert(sides[0].length === 4, 'each side quad should have 4 points');
  const [p0, p1, p2, p3] = sides[0];
  assertVec(p0, front[0], 'side quad follows front[i], front[i+1], back[i+1], back[i]');
  assertVec(p1, front[1], 'side quad follows front[i], front[i+1], back[i+1], back[i]');
  assertVec(p2, back[1], 'side quad follows front[i], front[i+1], back[i+1], back[i]');
  assertVec(p3, back[0], 'side quad follows front[i], front[i+1], back[i+1], back[i]');
});

test('the last side quad wraps around from the last vertex back to the first, closing the loop', () => {
  const outline = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
  const { front, back, sides } = extrudeOutline3D(outline, 2);
  const last = sides[sides.length - 1];
  assertVec(last[0], front[3], 'wraps from the last outline vertex...');
  assertVec(last[1], front[0], '...back to the first');
  assertVec(last[2], back[0], '...back to the first');
  assertVec(last[3], back[3], 'wraps from the last outline vertex...');
});

test('zero thickness collapses front and back onto the same plane, but still produces (degenerate) side quads', () => {
  const outline = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
  const { front, back, sides } = extrudeOutline3D(outline, 0);
  outline.forEach((p, i) => {
    assertVec(front[i], { x: p.x, y: p.y, z: 0 }, `front[${i}]`);
    assertVec(back[i], { x: p.x, y: p.y, z: 0 }, `back[${i}]`);
  });
  assert(sides.length === 4, 'still one side quad per edge, even if visually flat');
});

test('an outline with more than 4 vertices (a finger-jointed edge) produces one side quad per edge, matching outline.length', () => {
  const outline = [
    { x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: -2 }, { x: 6, y: -2 }, { x: 6, y: 0 }, { x: 10, y: 0 },
    { x: 10, y: 5 }, { x: 0, y: 5 },
  ];
  const { front, back, sides } = extrudeOutline3D(outline, 3);
  assert(front.length === outline.length && back.length === outline.length && sides.length === outline.length,
    'front/back/sides should each have exactly one entry per outline vertex/edge, regardless of shape complexity');
});

run();
