// populateScene's face/edge coloring is deliberately DOM-free (plain hex
// constants, no getComputedStyle) — see the plan's rationale in
// ThreeJsScene.js — which is what makes it plain-Node testable here, same
// harness as piecePlacement3D.test.js.
import { test, assert, run } from './testHarness.js';
import * as THREE from 'three';
import { createGrid } from '../model/Grid.js';
import { createDefaultProject } from '../state/Project.js';
import { populateScene, ALL_GROUPS_VISIBLE } from '../ui/ThreeJsScene.js';

function fixtureProject() {
  const project = createDefaultProject();
  project.grid = createGrid([50, 50], [50, 50]);
  project.outerThicknessMm = 3;
  project.innerThicknessMm = 2;
  project.drawer = { ...project.drawer, enabled: true };
  return project;
}

test('every mesh gets exactly two materials, one for faces and one for edges', () => {
  const scene = new THREE.Scene();
  populateScene(scene, fixtureProject());
  assert(scene.children.length > 0, 'expected at least one mesh in the scene');
  for (const mesh of scene.children) {
    assert(Array.isArray(mesh.material), `expected mesh.material to be an array, got ${typeof mesh.material}`);
    assert(mesh.material.length === 2, `expected 2 materials, got ${mesh.material.length}`);
  }
});

test('every piece is colored identically, regardless of outer/inner/drawer group', () => {
  const scene = new THREE.Scene();
  populateScene(scene, fixtureProject());
  const [firstFace, firstEdge] = scene.children[0].material;
  for (const mesh of scene.children) {
    const [face, edge] = mesh.material;
    assert(face.color.getHexString() === firstFace.color.getHexString(), 'face color should be the same across every piece');
    assert(edge.color.getHexString() === firstEdge.color.getHexString(), 'edge color should be the same across every piece');
  }
});

test('populating the same scene twice in a row does not throw', () => {
  const scene = new THREE.Scene();
  const project = fixtureProject();
  populateScene(scene, project);
  populateScene(scene, project);
  assert(scene.children.length > 0, 'expected meshes to survive a second populate call');
});

function projectWithOnePanel() {
  const project = fixtureProject();
  project.horizontalPanels = [{ id: 'horizontal-panel-1', heightMm: 20, coverage: null }];
  return project;
}

function panelMesh(scene) {
  return scene.children.find((mesh) => mesh.userData.pieceId === 'horizontal-panel-1');
}

test('populateScene() should show each horizontal panel, and hide them all when their group is unticked', () => {
  const shown = new THREE.Scene();
  populateScene(shown, projectWithOnePanel(), { visible: ALL_GROUPS_VISIBLE });
  const hidden = new THREE.Scene();
  populateScene(hidden, projectWithOnePanel(), { visible: { ...ALL_GROUPS_VISIBLE, horizontalPanels: false } });
  assert(panelMesh(shown), 'expected a mesh for the horizontal panel');
  assert(!panelMesh(hidden), 'expected no horizontal panel mesh once its group is hidden');
});

test('populateScene() should slide the horizontal panels out with the box when the drawer opens', () => {
  const closed = new THREE.Scene();
  populateScene(closed, projectWithOnePanel(), { openT: 0, visible: ALL_GROUPS_VISIBLE });
  const open = new THREE.Scene();
  populateScene(open, projectWithOnePanel(), { openT: 1, visible: ALL_GROUPS_VISIBLE });
  const closedOrigin = new THREE.Vector3().setFromMatrixPosition(panelMesh(closed).matrix);
  const openOrigin = new THREE.Vector3().setFromMatrixPosition(panelMesh(open).matrix);
  assert(closedOrigin.distanceTo(openOrigin) > 1, `expected the panel to move with the box, it stayed at ${JSON.stringify(closedOrigin)}`);
});

function projectWithImagesOnBasePlate() {
  const project = fixtureProject();
  project.pieceImages = {
    'base-plate': [
      { xMm: 10, yMm: 20, widthMm: 30, heightMm: 10, svg: '<svg id="first"/>' },
      { xMm: 50, yMm: 60, widthMm: 8, heightMm: 4, svg: '<svg id="second"/>' },
    ],
  };
  return project;
}

function pieceMesh(scene, pieceId) {
  return scene.children.find((mesh) => mesh.userData.pieceId === pieceId);
}

test('populateScene() should add one plane per engraved image to the mesh of its piece, centered on the image', () => {
  const scene = new THREE.Scene();
  populateScene(scene, projectWithImagesOnBasePlate());
  const planes = pieceMesh(scene, 'base-plate').children;
  assert(planes.length === 2, `expected 2 planes, got ${planes.length}`);
  assert(planes[0].position.x === 25 && planes[0].position.y === 25, `got ${JSON.stringify(planes[0].position)}`);
  assert(planes[1].geometry.parameters.width === 8 && planes[1].geometry.parameters.height === 4, 'expected the plane to have the size of the image');
});

test('populateScene() should add no plane to a piece without image', () => {
  const scene = new THREE.Scene();
  populateScene(scene, projectWithImagesOnBasePlate());
  assert(scene.children.every((mesh) => mesh.userData.pieceId === 'base-plate' || mesh.children.length === 0), 'only the base plate should carry planes');
});

test('populateScene() should dispose the planes of the previous scene when it populates again', () => {
  const scene = new THREE.Scene();
  const project = projectWithImagesOnBasePlate();
  populateScene(scene, project);
  const [plane] = pieceMesh(scene, 'base-plate').children;
  const disposed = { geometry: false, material: false };
  plane.geometry.addEventListener('dispose', () => { disposed.geometry = true; });
  plane.material.addEventListener('dispose', () => { disposed.material = true; });
  populateScene(scene, project);
  assert(disposed.geometry && disposed.material, `got ${JSON.stringify(disposed)}`);
});

run();
