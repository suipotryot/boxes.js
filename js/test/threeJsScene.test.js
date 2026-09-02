// populateScene's face/edge coloring is deliberately DOM-free (plain hex
// constants, no getComputedStyle) — see the plan's rationale in
// ThreeJsScene.js — which is what makes it plain-Node testable here, same
// harness as piecePlacement3D.test.js.
import { test, assert, run } from './testHarness.js';
import * as THREE from 'three';
import { createGrid } from '../model/Grid.js';
import { createDefaultProject } from '../state/Project.js';
import { populateScene } from '../ui/ThreeJsScene.js';

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

run();
