// Turns a flat 2D outline (piece.outline / piece.holes — straight-line
// segments only, no arcs/beziers anywhere in this codebase, see SvgPath.js's
// own subpath()) plus a material thickness into plain local-space
// front/back/side face data. Placement-agnostic on purpose: never touches
// grid/project, stays testable with a bare fabricated outline. A 3D
// adapter combines this with PiecePlacement3D.toWorld() before ever
// touching a rendering library.

/**
 * @param {{x:number,y:number}[]} outline2D a closed polygon, straight
 *   edges only.
 * @param {number} thicknessMm
 * @returns {{
 *   front: {x,y,z}[],   // outline2D verbatim, z:0
 *   back:  {x,y,z}[],   // same x,y, z:thicknessMm
 *   sides: {x,y,z}[][], // one quad [front[i],front[i+1],back[i+1],back[i]] per edge
 * }}
 */
export function extrudeOutline3D(outline2D, thicknessMm) {
  const front = outline2D.map((p) => ({ x: p.x, y: p.y, z: 0 }));
  const back = outline2D.map((p) => ({ x: p.x, y: p.y, z: thicknessMm }));

  const n = outline2D.length;
  const sides = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    sides.push([front[i], front[j], back[j], back[i]]);
  }

  return { front, back, sides };
}
