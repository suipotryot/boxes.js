// The base plate's outline is the box's outer footprint, with open notches
// carved directly into its boundary wherever an outer wall's bottom comb
// has a 'finger' — never as separate hole polygons that merely touch the
// boundary. Two independently-offset subpaths (outline vs. a "touching"
// hole) can drift apart under burn correction and leave an uncut sliver;
// carving the notch into the outline itself makes that impossible.
import { fingerEdgePath } from './FingerJoint.js';
import { simplifyPolygon } from './Point.js';
import { matingProtrusion } from './PanelBuilder.js';
import { resolveThickness } from '../model/GridQuery.js';
import { xAt, yAt } from '../model/Grid.js';

// segments: array of {seg, length, offset} along one boundary edge, in
// traversal order. `project`/`fj` as usual. `inward` is the unit vector
// pointing into the plate (away from the boundary). `axisPoint(offset)`
// maps a 1D offset along this edge to the boundary's 2D {x,y}.
function edgeNotchPoints(segments, fj, axisPoint, inward, reverse) {
  const pts = [];
  for (const { seg, length, offset } of segments) {
    const startWithFinger = seg.wallKind === 'v';
    const half = matingProtrusion(seg.thicknessMm);
    const combSegs = half > 0 ? fingerEdgePath(length, fj, startWithFinger) : [{ start: 0, length, kind: 'flush' }];
    for (const cs of combSegs) {
      const depth = cs.kind === 'finger' ? half : 0;
      const p0 = axisPoint(offset + cs.start);
      const p1 = axisPoint(offset + cs.start + cs.length);
      pts.push({ x: p0.x + inward.x * depth, y: p0.y + inward.y * depth });
      pts.push({ x: p1.x + inward.x * depth, y: p1.y + inward.y * depth });
    }
  }
  return reverse ? pts.slice().reverse() : pts;
}

export function buildBasePlate(grid, project) {
  const cols = grid.sx.length;
  const rows = grid.sy.length;
  const W = grid.sx.reduce((a, b) => a + b, 0);
  const D = grid.sy.reduce((a, b) => a + b, 0);
  const fj = project.fingerJoint;

  const topSegs = [];
  for (let c = 0; c < cols; c++) {
    const seg = grid.hWalls[c][0];
    if (seg.present) topSegs.push({ seg: { ...seg, wallKind: 'h' }, length: grid.sx[c], offset: xAt(grid, c), thicknessMm: resolveThickness(seg, project) });
  }
  const rightSegs = [];
  for (let r = 0; r < rows; r++) {
    const seg = grid.vWalls[cols][r];
    if (seg.present) rightSegs.push({ seg: { ...seg, wallKind: 'v' }, length: grid.sy[r], offset: yAt(grid, r), thicknessMm: resolveThickness(seg, project) });
  }
  const bottomSegs = [];
  for (let c = 0; c < cols; c++) {
    const seg = grid.hWalls[c][rows];
    if (seg.present) bottomSegs.push({ seg: { ...seg, wallKind: 'h' }, length: grid.sx[c], offset: xAt(grid, c), thicknessMm: resolveThickness(seg, project) });
  }
  const leftSegs = [];
  for (let r = 0; r < rows; r++) {
    const seg = grid.vWalls[0][r];
    if (seg.present) leftSegs.push({ seg: { ...seg, wallKind: 'v' }, length: grid.sy[r], offset: yAt(grid, r), thicknessMm: resolveThickness(seg, project) });
  }

  const withMag = (segs) => segs.map((s) => ({ seg: { ...s.seg, thicknessMm: s.thicknessMm }, length: s.length, offset: s.offset }));

  const top = edgeNotchPoints(withMag(topSegs), fj, (u) => ({ x: u, y: 0 }), { x: 0, y: 1 }, false);
  const right = edgeNotchPoints(withMag(rightSegs), fj, (u) => ({ x: W, y: u }), { x: -1, y: 0 }, false);
  const bottom = edgeNotchPoints(withMag(bottomSegs), fj, (u) => ({ x: u, y: D }), { x: 0, y: -1 }, true);
  const left = edgeNotchPoints(withMag(leftSegs), fj, (u) => ({ x: 0, y: u }), { x: 1, y: 0 }, true);

  const outline = simplifyPolygon([...top, ...right, ...bottom, ...left]);

  return {
    id: 'base-plate',
    kind: 'basePlate',
    thicknessGroup: 'outer',
    thicknessMm: project.outerThicknessMm,
    outline,
    holes: [],
  };
}
