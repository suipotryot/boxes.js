import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import type { Panel } from '@/domain/models/Panel';
import { panelToMesh } from '../MeshBuilders';

function wallPanel(rotationZ: number): Panel {
  return {
    id: 'p1',
    kind: 'dividerWall',
    materialThickness: 2,
    outline: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 5 },
      { x: 0, y: 5 },
    ],
    holes: [],
    placement3d: { origin: { x: 0, y: 0, z: 0 }, rotationZ },
    sourceIds: [],
  };
}

describe('panelToMesh: wall orientation', () => {
  it('produces a proper rotation (no reflection) for the mesh basis, regardless of rotationZ', () => {
    // A reflection (determinant -1) can't be represented by a quaternion:
    // Quaternion.setFromRotationMatrix silently returns *some* quaternion
    // for one anyway, producing a mesh with the right position but the
    // wrong orientation -- this is exactly the class of bug that shipped
    // (positions correct, every wall panel's orientation wrong). Checking
    // handedness directly here, not just a couple of sample angles by eye,
    // is what would have caught it.
    for (const rotationZ of [0, Math.PI / 4, Math.PI / 2, Math.PI, (3 * Math.PI) / 2, 1.23456]) {
      const mesh = panelToMesh(wallPanel(rotationZ), '#ffffff');
      const m = new THREE.Matrix4().makeRotationFromQuaternion(mesh.quaternion);
      expect(m.determinant()).toBeCloseTo(1, 6);
    }
  });

  it('maps the local along-wall axis onto the expected world direction for rotationZ = 0', () => {
    const mesh = panelToMesh(wallPanel(0), '#ffffff');
    // Local +X (along the wall's own length) should land on world +X when
    // the wall runs along the +X axis (rotationZ = 0).
    const worldPoint = new THREE.Vector3(1, 0, 0).applyQuaternion(mesh.quaternion);
    expect(worldPoint.x).toBeCloseTo(1, 6);
    expect(worldPoint.y).toBeCloseTo(0, 6);
    expect(worldPoint.z).toBeCloseTo(0, 6);
  });

  it('maps the local height axis onto world +Z for any rotationZ (walls always stand upright)', () => {
    for (const rotationZ of [0, Math.PI / 3, Math.PI, 2.7]) {
      const mesh = panelToMesh(wallPanel(rotationZ), '#ffffff');
      const worldUp = new THREE.Vector3(0, 1, 0).applyQuaternion(mesh.quaternion);
      expect(worldUp.x).toBeCloseTo(0, 6);
      expect(worldUp.y).toBeCloseTo(0, 6);
      expect(worldUp.z).toBeCloseTo(1, 6);
    }
  });

  it('rotates the along-wall axis to match rotationZ = 90 degrees (wall running along +Y)', () => {
    const mesh = panelToMesh(wallPanel(Math.PI / 2), '#ffffff');
    const worldPoint = new THREE.Vector3(1, 0, 0).applyQuaternion(mesh.quaternion);
    expect(worldPoint.x).toBeCloseTo(0, 6);
    expect(worldPoint.y).toBeCloseTo(1, 6);
    expect(worldPoint.z).toBeCloseTo(0, 6);
  });
});
