import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import type { Panel } from '@/domain/models/Panel';
import { panelToMesh } from './MeshBuilders';

// Z is "up" everywhere in this codebase's domain model (placement3d.origin.z,
// ShelfConfig.heightMm) -- match that convention for the camera/controls too,
// rather than Three's default Y-up, so panels don't need re-orienting here.
THREE.Object3D.DEFAULT_UP.set(0, 0, 1);

const SHELF_KINDS = new Set<Panel['kind']>(['shelf', 'shelfCleat']);

export class Scene3D {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly controls: OrbitControls;

  private meshGroup = new THREE.Group();
  private animationHandle: number | null = null;

  constructor(container: HTMLElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x22252c);
    this.scene.add(this.meshGroup);

    this.camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 1, 10_000);
    this.camera.position.set(400, -400, 350);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 0, 50);
    this.controls.update();

    // A fairly strong, direction-agnostic ambient term matters more here
    // than in a typical scene: this box is open (no lid modeled), so the
    // camera frequently looks straight into interior wall/floor faces that
    // point away from every directional light. Under-lighting those made
    // them read as near-black against the dark scene background --
    // plausibly why what was actually correct (if dim) geometry looked
    // like a missing/"transparent" face at a glance.
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.1));
    const keyLight = new THREE.DirectionalLight(0xffffff, 0.8);
    keyLight.position.set(300, -200, 500);
    this.scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
    fillLight.position.set(-300, 200, 100);
    this.scene.add(fillLight);
    const bounceLight = new THREE.DirectionalLight(0xffffff, 0.4);
    bounceLight.position.set(0, 300, -200);
    this.scene.add(bounceLight);

    this.animate();
  }

  /** Rebuilds every mesh from scratch -- simple and fast enough at this
   * project's scale (dozens to a few hundred panels), avoids diffing. */
  rebuild(panels: Panel[], colorForPanel: (panel: Panel) => string, shelfVisible: boolean): void {
    this.scene.remove(this.meshGroup);
    disposeGroup(this.meshGroup);

    this.meshGroup = new THREE.Group();
    const visible = shelfVisible ? panels : panels.filter((p) => !SHELF_KINDS.has(p.kind));
    for (const panel of visible) {
      this.meshGroup.add(panelToMesh(panel, colorForPanel(panel)));
    }
    this.scene.add(this.meshGroup);
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  destroy(): void {
    if (this.animationHandle !== null) {
      cancelAnimationFrame(this.animationHandle);
    }
    disposeGroup(this.meshGroup);
    this.controls.dispose();
    this.renderer.dispose();
  }

  private animate = (): void => {
    this.animationHandle = requestAnimationFrame(this.animate);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };
}

function disposeGroup(group: THREE.Group): void {
  for (const child of group.children) {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      if (Array.isArray(child.material)) {
        child.material.forEach((m) => m.dispose());
      } else {
        child.material.dispose();
      }
    }
  }
}
