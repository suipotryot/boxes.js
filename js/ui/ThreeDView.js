// Mounts a three.js canvas showing the assembled box, following the same
// mount*View(container, opts) -> {unmount()} contract used everywhere else
// (AppShell.js's mountScreen/mountEditorScreen) — plus updateProject(),
// so the caller can push new project state without re-mounting (which
// would reset the user's current orbit/zoom, see EditorView.js).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { el, clear } from './dom.js';
import { t } from '../i18n/index.js';
import { outerBoxWidth, outerBoxDepth, outerBoxHeight } from '../model/GridQuery.js';
import { populateScene } from './ThreeJsScene.js';

/**
 * @param {HTMLElement} container appended into immediately; owned by the
 *   caller for the whole lifetime of the returned handle.
 * @param {object} project
 * @returns {{ unmount(): void, updateProject(project): void }}
 */
export function mountThreeDView(container, project) {
  const canvas = el('canvas', { class: 'threed-canvas' });
  const hint = el('div', { class: 'hint threed-hint', text: t('editor.view3dHint') });
  container.appendChild(canvas);
  container.appendChild(hint);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 1, 10000);
  camera.up.set(0, 0, 1); // our world is Z-up (height); OrbitControls orbits around this axis

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });

  scene.add(new THREE.HemisphereLight(0xffffff, 0x404040, 3));
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.5);
  keyLight.position.set(1, 1.5, 1);
  scene.add(keyLight);

  // Pieces live in their own group, separate from the lights above:
  // populateScene() clears+disposes every child it's handed on each call,
  // and a Light has no .geometry/.material to dispose — mixing them into
  // the same container would throw the moment a second populateScene()
  // call (updateProject) tried to dispose a light as if it were a mesh.
  const pieceGroup = new THREE.Group();
  scene.add(pieceGroup);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  // Keep the camera above the box: nothing about the design is visible
  // from directly underneath (the base plate's own outer face is a plain
  // rectangle — piece.holes aren't cut into the 3D geometry yet, see
  // ThreeJsScene.js), and at a near-horizontal-or-below angle the walls'
  // and dividers' own thin (3mm) profile is viewed almost perfectly
  // edge-on, which reads as confusing thin-line aliasing rather than a
  // legible box.
  controls.minPolarAngle = 0.1;
  controls.maxPolarAngle = Math.PI / 2 + 0.3;

  populateScene(pieceGroup, project);
  fitView(camera, controls, project);

  // A ResizeObserver rather than a synchronous getBoundingClientRect() at
  // mount time: `container` isn't actually inserted into the live document
  // until AFTER this function returns (EditorView.js appends the whole
  // editor tree in one go at the end of its own render()), so a
  // synchronous read here would measure a detached 0x0 box — exactly the
  // bug the Zdog version of this file hit before being replaced with this
  // approach, which keeps re-measuring as the real layout settles.
  const resizeObserver = new ResizeObserver((entries) => {
    const { width, height } = entries[0].contentRect;
    if (width === 0 || height === 0) return;
    renderer.setSize(width, height, false); // false: don't fight our own CSS sizing
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  });
  resizeObserver.observe(canvas);

  let raf = requestAnimationFrame(animate);
  function animate() {
    controls.update(); // required every frame while enableDamping is on
    renderer.render(scene, camera);
    raf = requestAnimationFrame(animate);
  }

  return {
    updateProject(nextProject) {
      populateScene(pieceGroup, nextProject);
    },
    unmount() {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      controls.dispose();
      pieceGroup.children.slice().forEach((mesh) => {
        mesh.geometry.dispose();
        mesh.material.dispose();
      });
      renderer.dispose();
      clear(container);
    },
  };
}

// Centers the orbit target on the box's own middle point and backs the
// camera off along a fixed 3/4 direction, far enough that a sphere around
// the box's own diagonal fits the vertical field of view. Only called once,
// right after the first mount — NOT on every updateProject — so a later
// edit never undoes the framing/rotation the user set by hand (same
// reasoning as EditorView.js's persistent threeDContainer).
function fitView(camera, controls, project) {
  const w = outerBoxWidth(project.grid, project);
  const d = outerBoxDepth(project.grid, project);
  const h = outerBoxHeight(project.grid, project);
  const center = new THREE.Vector3(w / 2, d / 2, h / 2);
  const radius = Math.sqrt(w * w + d * d + h * h) / 2;
  const fovRadians = (camera.fov * Math.PI) / 180;
  const distance = (radius / Math.sin(fovRadians / 2)) * 1.15; // 15% margin

  const direction = new THREE.Vector3(-0.6, -0.6, 0.5).normalize();
  camera.position.copy(center).addScaledVector(direction, distance);
  camera.lookAt(center);
  controls.target.copy(center);
  controls.update();
}
