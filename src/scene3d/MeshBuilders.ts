import * as THREE from 'three';

import type { Panel } from '@/domain/models/Panel';
import type { Point } from '@/domain/models/types';
import { simplifyPolygon } from '@/domain/services/GeometryUtils';

/** basePlate/shelf outlines are already in world-aligned (x, y) plan
 * coordinates (see BasePlateBuilder/ShelfBuilder) and extrude straight up
 * along Z. Wall panels (outerWall/dividerWall/shelfCleat) are unrolled
 * elevations -- local (u, v) meaning (along the wall's run, height) -- and
 * need re-orienting into a vertical plane along the wall's real direction. */
const HORIZONTAL_KINDS = new Set<Panel['kind']>(['basePlate', 'shelf']);

export function panelToMesh(panel: Panel, colorHex: string): THREE.Mesh {
  const shape = buildShape(panel.outline, panel.holes);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: panel.materialThickness, bevelEnabled: false });
  const material = new THREE.MeshStandardMaterial({ color: colorHex, side: THREE.DoubleSide });

  // ExtrudeGeometry extrudes a flat shape from local Z=0 to Z=depth --
  // entirely to one side. basePlate/shelf outlines are genuinely meant to
  // sit ON their own Z origin (the floor, or the shelf height) and extend
  // upward, so that's correct as-is. But wall.a/wall.b (a wall panel's own
  // placement3d.origin) is documented everywhere as the wall's CENTERLINE
  // -- the 2D canvas draws it centered (WallRenderer's offsetY:
  // thickness/2) -- so a wall's mesh must be re-centered here too, or its
  // actual material sits shifted a full half-thickness off that centerline
  // while every hole cut for it elsewhere (BasePlateBuilder's
  // bottomFingerHoles, sized symmetrically around the same centerline)
  // stays put -- exposing a half-thickness sliver of whatever is
  // behind/below through each hole instead of the tooth fully plugging it.
  if (!HORIZONTAL_KINDS.has(panel.kind)) {
    geometry.translate(0, 0, -panel.materialThickness / 2);
  }

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = panel.id;

  const origin = panel.placement3d?.origin ?? { x: 0, y: 0, z: 0 };
  mesh.position.set(origin.x, origin.y, origin.z);

  if (!HORIZONTAL_KINDS.has(panel.kind)) {
    const rotationZ = panel.placement3d?.rotationZ ?? 0;
    // Map local (X, Y, Z) = (along-wall, height, extrude) onto world
    // (u direction, +Z, direction perpendicular to the wall) via an
    // explicit basis matrix -- more reliable than composing Euler angles,
    // which don't commute the way "rotate 90 then rotate by rotationZ"
    // naively suggests. extrudeDir MUST be uDir x heightDir (not the
    // hand-picked perpendicular that was here before): Quaternion.
    // setFromRotationMatrix assumes a proper rotation (determinant +1), and
    // -(uDir x heightDir) makes the basis left-handed (determinant -1, a
    // reflection) -- the extraction still returns *a* quaternion, just one
    // that doesn't represent the intended transform, so every wall panel
    // came out mispositioned in orientation while still translating to the
    // right origin (position and rotation are independent in a Matrix4).
    const uDir = new THREE.Vector3(Math.cos(rotationZ), Math.sin(rotationZ), 0);
    const heightDir = new THREE.Vector3(0, 0, 1);
    const extrudeDir = uDir.clone().cross(heightDir);
    const basis = new THREE.Matrix4().makeBasis(uDir, heightDir, extrudeDir);
    mesh.quaternion.setFromRotationMatrix(basis);
  }

  return mesh;
}

function buildShape(outline: Point[], holes: Point[][]): THREE.Shape {
  // Defensive: panel-building can leave exact-duplicate/collinear points
  // (see simplifyPolygon's own docstring) that don't affect a plain SVG
  // renderer but are cheap to strip before handing the outline to
  // ExtrudeGeometry's triangulator.
  const shape = new THREE.Shape(simplifyPolygon(outline).map((p) => new THREE.Vector2(p.x, p.y)));
  for (const hole of holes) {
    shape.holes.push(new THREE.Path(simplifyPolygon(hole).map((p) => new THREE.Vector2(p.x, p.y))));
  }
  return shape;
}
