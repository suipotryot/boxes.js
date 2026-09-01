// The one file that imports three.js directly — converts computePieces()
// output into real 3D meshes, via PiecePlacement3D (world placement,
// unchanged from the earlier Zdog version — a plain orthonormal basis,
// which maps directly onto a THREE.Matrix4 via makeBasis()/setPosition(),
// so there's still no rotation-composition convention to get wrong). Each
// piece becomes exactly ONE Mesh: three.js's own ExtrudeGeometry builds
// the whole solid (front, back, AND side walls) from piece.outline in one
// call, so unlike the Zdog version, no separate per-face bookkeeping
// module is needed anymore.
import * as THREE from 'three';
import { computePieces } from '../geometry/PieceFactory.js';
import { computePiecePlacement3D } from '../geometry/PiecePlacement3D.js';
import { DRAWER_PREFIX } from '../geometry/DrawerBuilder.js';

// v1 scope (see the plan): base plate, every wall run, and the lid — same
// as before. Drawer pieces stay out (no world-offset for the sleeve
// exists anywhere in the pipeline yet).
const SUPPORTED_KINDS = new Set(['basePlate', 'lid', 'wall']);

function pieceColor(piece) {
  const varName = piece.thicknessGroup === 'outer' ? '--outer' : '--inner';
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
}

// Shared point-tracing walk: a THREE.Shape (the outer contour) and a
// THREE.Path (one hole) are built identically — moveTo the first point,
// lineTo every other, close — Path is simply Shape's own superclass.
// piece.outline/piece.holes are always straight-line polygons (confirmed:
// no arc/bezier anywhere in this codebase's geometry, even a "rounded"
// user hole is a polyline approximation, see Hole.js), so lineTo is all
// either one ever needs.
function tracePoints(path, points) {
  path.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) path.lineTo(points[i].x, points[i].y);
  path.closePath();
  return path;
}

function buildShape(outline2D) {
  return tracePoints(new THREE.Shape(), outline2D);
}

// Hole winding relative to the outer shape doesn't need to be checked or
// corrected here: three.js's own triangulator (Earcut, vendored under
// node_modules/three/src/extras/lib/earcut.js) re-derives and forces a
// canonical winding for the outer ring and for every hole ring
// independently on every call, regardless of the order points are
// supplied in — verified directly in that source, not assumed. This only
// holds for the flat (non-bevelled) extrusion path used below
// (`bevelEnabled: false`); a bevelled edge would additionally need
// winding-correct input for its bevel-offset math, which this app never
// uses.
function buildHolePath(points2D) {
  return tracePoints(new THREE.Path(), points2D);
}

// world = origin + local.x*uAxis + local.y*vAxis + local.z*wAxis (the
// exact convention PiecePlacement3D's own doc comment defines) is exactly
// what Matrix4.makeBasis(uAxis, vAxis, wAxis) + setPosition(origin)
// produces: a column-basis matrix with those three vectors as its
// rotation columns and origin as its translation.
function placementToMatrix(placement) {
  const { origin, uAxis, vAxis, wAxis } = placement;
  return new THREE.Matrix4()
    .makeBasis(
      new THREE.Vector3(uAxis.x, uAxis.y, uAxis.z),
      new THREE.Vector3(vAxis.x, vAxis.y, vAxis.z),
      new THREE.Vector3(wAxis.x, wAxis.y, wAxis.z),
    )
    .setPosition(origin.x, origin.y, origin.z);
}

function disposeMesh(mesh) {
  mesh.geometry.dispose();
  mesh.material.dispose();
}

/** Clears and repopulates `scene` with one Mesh per eligible piece of
 *  computePieces(project). Disposes every previous mesh's geometry and
 *  material first — this rebuilds from scratch on every project edit
 *  (same as the rest of this app's DOM rendering), and WebGL resources
 *  aren't garbage-collected on their own; skipping this would leak GPU
 *  memory for the length of an editing session. */
export function populateScene(scene, project) {
  scene.children.slice().forEach((mesh) => {
    scene.remove(mesh);
    disposeMesh(mesh);
  });

  const pieces = computePieces(project)
    .filter((p) => SUPPORTED_KINDS.has(p.kind) && !p.id.startsWith(DRAWER_PREFIX));

  for (const piece of pieces) {
    const placement = computePiecePlacement3D(project.grid, project, piece);
    const shape = buildShape(piece.outline);
    shape.holes = piece.holes.map(buildHolePath);
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: piece.thicknessMm, bevelEnabled: false });
    // DoubleSide: piece.outline winding order isn't guaranteed consistent
    // across every builder (BasePlateBuilder/PanelBuilder/LidBuilder each
    // compose their own outline independently) — rather than chase down
    // and fix winding per piece kind, render both faces so nothing can
    // ever vanish from a given viewing angle due to backface culling.
    const material = new THREE.MeshStandardMaterial({ color: pieceColor(piece), side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.matrixAutoUpdate = false;
    mesh.matrix.copy(placementToMatrix(placement));
    scene.add(mesh);
  }
}
