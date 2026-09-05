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
import { Box } from '../geometry/oo/Box.js';
import { computePiecePlacement3D, translatePlacement, computeDrawerSlideVector } from '../geometry/PiecePlacement3D.js';
import { DRAWER_PREFIX } from '../geometry/oo/Drawer.js';

// base plate, every wall run, and the lid — the same kinds computePieces()
// itself groups drawer sleeve pieces under too (see PiecePlacement3D.js,
// which resolves a drawer-prefixed id against the sleeve's own synthetic
// grid and offsets the result into the main box's world space).
const SUPPORTED_KINDS = new Set(['basePlate', 'lid', 'wall']);

const ZERO_VECTOR = { x: 0, y: 0, z: 0 };

// The 4 independently-hideable/-slideable groups the 3D preview's own
// checkboxes and "open the drawer" slider (see ThreeDView.js) operate on.
// The sleeve's own lid gets its own group ('couvercleManchon'), split out
// from the rest of the sleeve ('manchon', base + walls) rather than
// bundled as one — the sleeve's lid is a solid, permanent ceiling over
// its own base plate (never toggled open by the slider, unlike the main
// box's own lid/walls, which slide away together): without a way to hide
// JUST the sleeve's lid, nothing under it — the base plate itself, or any
// hole cut into it — could ever be seen, since the camera is also never
// allowed to look up from underneath (see ThreeDView.js's minPolarAngle/
// maxPolarAngle). Neither sleeve group ever slides with the "open the
// drawer" control — only the main box's own two groups do.
function pieceGroupName(piece) {
  const isDrawer = piece.id.startsWith(DRAWER_PREFIX);
  if (piece.kind === 'lid') return isDrawer ? 'couvercleManchon' : 'couvercle';
  return isDrawer ? 'manchon' : 'box';
}

// Pseudo-realistic laser-cut plywood look: light beige panel faces, dark
// burnt-edge sides — the same two colors for every piece, regardless of
// thickness group or drawer membership (that distinction stays a 2D-grid-
// editor-only concept, css/style.css's --outer/--inner). Plain hex
// constants rather than CSS custom properties: nothing here is ever
// changed at runtime (no theme toggle), so going through
// getComputedStyle(document.documentElement) would just be DOM dependency
// for no benefit — and dropping it is what makes this file plain-Node
// testable (see js/test/threeJsScene.test.js).
const FACE_COLOR = '#e8dcc0';
const EDGE_COLOR = '#3a2a1d';

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
  mesh.material.forEach((m) => m.dispose());
}

/** Clears and repopulates `scene` with one Mesh per eligible, currently
 *  visible piece of computePieces(project). Disposes every previous mesh's
 *  geometry and material first — this rebuilds from scratch on every
 *  project edit (same as the rest of this app's DOM rendering), and WebGL
 *  resources aren't garbage-collected on their own; skipping this would
 *  leak GPU memory for the length of an editing session.
 *
 * @param {object} [opts]
 * @param {number} [opts.openT] 0 (closed/nested) to 1 (fully clear of the
 *   sleeve) — the "open the drawer" slider; only ever moves the main box's
 *   own pieces (box + couvercle groups), never the sleeve itself.
 * @param {{box:boolean, manchon:boolean, couvercle:boolean, couvercleManchon:boolean}} [opts.visible]
 *   per-group checkbox state — a piece whose group is false is simply
 *   skipped, never added to the scene. */
export function populateScene(scene, project, { openT = 0, visible = { box: true, manchon: true, couvercle: true, couvercleManchon: true } } = {}) {
  scene.children.slice().forEach((mesh) => {
    scene.remove(mesh);
    disposeMesh(mesh);
  });

  const slideVector = project.drawer?.enabled ? computeDrawerSlideVector(project.grid, project, openT) : ZERO_VECTOR;
  const pieces = Box.fromProject(project).allPiecesBurnCorrected().filter((p) => SUPPORTED_KINDS.has(p.kind));

  for (const piece of pieces) {
    const group = pieceGroupName(piece);
    if (!visible[group]) continue;

    let placement = computePiecePlacement3D(project.grid, project, piece);
    if (group === 'box' || group === 'couvercle') placement = translatePlacement(placement, slideVector);

    const shape = buildShape(piece.outline);
    shape.holes = piece.holes.map(buildHolePath);
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: piece.thicknessMm, bevelEnabled: false });
    // DoubleSide (on both materials below): piece.outline winding order
    // isn't guaranteed consistent across every builder
    // (BasePlateBuilder/PanelBuilder/LidBuilder each compose their own
    // outline independently) — rather than chase down and fix winding per
    // piece kind, render both faces so nothing can ever vanish from a
    // given viewing angle due to backface culling.
    // ExtrudeGeometry always emits exactly two geometry groups — group 0:
    // the front+back caps (the panel faces), group 1: the side walls (the
    // extrusion's edge) — so an array of two materials here maps straight
    // onto that split with no geometry changes needed.
    const materials = [
      new THREE.MeshStandardMaterial({ color: FACE_COLOR, side: THREE.DoubleSide }),
      new THREE.MeshStandardMaterial({ color: EDGE_COLOR, side: THREE.DoubleSide }),
    ];
    const mesh = new THREE.Mesh(geometry, materials);
    mesh.matrixAutoUpdate = false;
    mesh.matrix.copy(placementToMatrix(placement));
    mesh.userData.pieceId = piece.id;
    scene.add(mesh);
  }
}
