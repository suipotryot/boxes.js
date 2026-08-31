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
//
// piece.holes are deliberately NOT cut into the extruded solid yet, even
// though ExtrudeGeometry supports it natively via THREE.Shape.holes
// (unlike Zdog, this is no longer a technical limitation — just a
// deferred follow-up step). To add them later: build a THREE.Path per
// piece.holes entry the same way buildShape() below builds the outer
// shape, and push each onto `shape.holes` before constructing the
// ExtrudeGeometry.
const SUPPORTED_KINDS = new Set(['basePlate', 'lid', 'wall']);

function pieceColor(piece) {
  const varName = piece.thicknessGroup === 'outer' ? '--outer' : '--inner';
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
}

function buildShape(outline2D) {
  const shape = new THREE.Shape();
  shape.moveTo(outline2D[0].x, outline2D[0].y);
  for (let i = 1; i < outline2D.length; i++) shape.lineTo(outline2D[i].x, outline2D[i].y);
  shape.closePath();
  return shape;
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
