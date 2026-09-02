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
import { buildSleeveContext, computeDrawerOffset } from '../geometry/DrawerBuilder.js';
import { populateScene } from './ThreeJsScene.js';

/**
 * @param {HTMLElement} container appended into immediately; owned by the
 *   caller for the whole lifetime of the returned handle.
 * @param {object} project
 * @returns {{ unmount(): void, updateProject(project): void }}
 */
export function mountThreeDView(container, project) {
  // UI-only state, never part of the project model — lives exactly as
  // long as this mount, same as the camera's own orbit/zoom (see
  // EditorView.js's persistent threeDContainer): resets on remount, but
  // survives across updateProject() calls, so editing the project doesn't
  // undo a checkbox the user unticked or a drawer position they set.
  let currentProject = project;
  let openT = 0;
  const visible = { box: true, manchon: true, couvercle: true, couvercleManchon: true };

  function refreshScene() {
    populateScene(pieceGroup, currentProject, { openT, visible });
  }

  const boxCheckbox = el('input', { type: 'checkbox', checked: true, onChange: (e) => { visible.box = e.target.checked; refreshScene(); } });
  const manchonCheckbox = el('input', { type: 'checkbox', checked: true, onChange: (e) => { visible.manchon = e.target.checked; refreshScene(); } });
  const couvercleCheckbox = el('input', { type: 'checkbox', checked: true, onChange: (e) => { visible.couvercle = e.target.checked; refreshScene(); } });
  const couvercleManchonCheckbox = el('input', { type: 'checkbox', checked: true, onChange: (e) => { visible.couvercleManchon = e.target.checked; refreshScene(); } });
  const openSlider = el('input', {
    type: 'range', min: 0, max: 100, value: 0,
    onInput: (e) => { openT = Number(e.target.value) / 100; refreshScene(); },
  });

  const manchonLabel = el('label', { class: 'threed-control' }, [manchonCheckbox, t('editor.view3dShowDrawer')]);
  const couvercleLabel = el('label', { class: 'threed-control' }, [couvercleCheckbox, t('editor.view3dShowLid')]);
  // Its own checkbox, separate from manchonLabel above: the sleeve's lid
  // is a fixed, permanent ceiling over its own base plate (unlike the
  // main box's own lid, it never slides open) — without a way to hide it
  // independently, nothing under it (the base plate, or any hole cut into
  // it) could ever be seen, since the camera is also never allowed to
  // look up from underneath. See ThreeJsScene.pieceGroupName.
  const couvercleManchonLabel = el('label', { class: 'threed-control' }, [couvercleManchonCheckbox, t('editor.view3dShowDrawerLid')]);
  // Hidden (not just disabled) when their own piece group doesn't exist —
  // toggled in syncControls() below on every updateProject(), since the
  // drawer/lid can be turned on or off while the 3D tab stays open.
  const sliderLabel = el('label', { class: 'threed-control threed-slider' }, [t('editor.view3dDrawerOpen'), openSlider]);
  const controlsBar = el('div', { class: 'threed-controls' }, [
    el('label', { class: 'threed-control' }, [boxCheckbox, t('editor.view3dShowBox')]),
    manchonLabel,
    couvercleManchonLabel,
    couvercleLabel,
    sliderLabel,
  ]);

  function syncControls() {
    manchonLabel.hidden = !currentProject.drawer?.enabled;
    couvercleManchonLabel.hidden = !currentProject.drawer?.enabled;
    sliderLabel.hidden = !currentProject.drawer?.enabled;
    couvercleLabel.hidden = !currentProject.lid?.enabled;
  }

  const canvas = el('canvas', { class: 'threed-canvas' });
  const hint = el('div', { class: 'hint threed-hint', text: t('editor.view3dHint') });
  container.appendChild(controlsBar);
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
  // Keep the camera above the box: at a near-horizontal-or-below angle the
  // walls' and dividers' own thin (3mm) profile is viewed almost perfectly
  // edge-on, which reads as confusing thin-line aliasing rather than a
  // legible box.
  controls.minPolarAngle = 0.1;
  controls.maxPolarAngle = Math.PI / 2 + 0.3;

  syncControls();
  refreshScene();
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
      currentProject = nextProject;
      syncControls();
      refreshScene();
    },
    unmount() {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      controls.dispose();
      pieceGroup.children.slice().forEach((mesh) => {
        mesh.geometry.dispose();
        mesh.material.forEach((m) => m.dispose());
      });
      renderer.dispose();
      clear(container);
    },
  };
}

// Approximate world-space bounding box of a box built on (grid, project),
// optionally shifted by `offset` (used below for the drawer sleeve) — [0,w]
// x [0,d] x [0,h] is the same "ignore the outerThicknessMm margin's own
// sign" approximation this function already made for the main box before
// the drawer was added; harmless here too, it only ever pads fitView's own
// margin by a few mm.
function approximateBounds(grid, project, offset = { x: 0, y: 0, z: 0 }) {
  return {
    min: new THREE.Vector3(offset.x, offset.y, offset.z),
    max: new THREE.Vector3(
      offset.x + outerBoxWidth(grid, project),
      offset.y + outerBoxDepth(grid, project),
      offset.z + outerBoxHeight(grid, project),
    ),
  };
}

// Centers the orbit target on the assembled scene's own middle point and
// backs the camera off along a fixed 3/4 direction, far enough that a
// sphere around its diagonal fits the vertical field of view — including
// the drawer sleeve, when enabled, so it isn't cropped by a framing sized
// for the main box alone. Only called once, right after the first mount —
// NOT on every updateProject — so a later edit never undoes the framing/
// rotation the user set by hand (same reasoning as EditorView.js's
// persistent threeDContainer); it also always frames the CLOSED (openT:0)
// position, since that's the state the drawer slider always starts at.
function fitView(camera, controls, project) {
  const bounds = approximateBounds(project.grid, project);

  const sleeveCtx = buildSleeveContext(project.grid, project);
  if (sleeveCtx) {
    const { sleeveGrid, sleeveProject } = sleeveCtx;
    const sleeveBounds = approximateBounds(sleeveGrid, sleeveProject, computeDrawerOffset(project));
    bounds.min.min(sleeveBounds.min);
    bounds.max.max(sleeveBounds.max);
  }

  const center = bounds.min.clone().add(bounds.max).multiplyScalar(0.5);
  const radius = bounds.min.distanceTo(bounds.max) / 2;
  const fovRadians = (camera.fov * Math.PI) / 180;
  const distance = (radius / Math.sin(fovRadians / 2)) * 1.15; // 15% margin

  const direction = new THREE.Vector3(-0.6, -0.6, 0.5).normalize();
  camera.position.copy(center).addScaledVector(direction, distance);
  camera.lookAt(center);
  controls.target.copy(center);
  controls.update();
}
