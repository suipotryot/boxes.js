// applyDepthFlip is pure (Group + project in, transform set on the Group) —
// no canvas/WebGL/DOM needed to test it, only mountThreeDView (untested here)
// touches those. See threeJsScene.test.js for populateScene's own coverage.
import { test, assert, run } from './testHarness.js';
import * as THREE from 'three';
import { createGrid } from '../model/Grid.js';
import { createDefaultProject } from '../state/Project.js';
import { enumerateWallRuns, wallPieceId } from '../model/GridQuery.js';
import { populateScene } from '../ui/ThreeJsScene.js';
import { applyDepthFlip } from '../ui/ThreeDView.js';

function asymmetricProject() {
  const project = createDefaultProject();
  // Two rows of deliberately different depth: a symmetric grid can't reveal
  // a row-order mix-up (swapping two identical rows looks the same).
  project.grid = createGrid([50, 50], [30, 80]);
  project.outerThicknessMm = 3;
  project.innerThicknessMm = 2;
  return project;
}

test('applyDepthFlip puts row 0 at a larger world Y than the last row, matching the 2D editor\'s own top-to-bottom row order', () => {
  const project = asymmetricProject();
  const rows = project.grid.sy.length;

  const pieceGroup = new THREE.Group();
  populateScene(pieceGroup, project);
  applyDepthFlip(pieceGroup, project);
  pieceGroup.updateMatrixWorld(true);

  const frontRun = enumerateWallRuns(project.grid, project).find((r) => r.kind === 'h' && r.r === 0);
  const backRun = enumerateWallRuns(project.grid, project).find((r) => r.kind === 'h' && r.r === rows);
  const frontMesh = pieceGroup.children.find((m) => m.userData.pieceId === wallPieceId(frontRun));
  const backMesh = pieceGroup.children.find((m) => m.userData.pieceId === wallPieceId(backRun));
  assert(frontMesh, 'expected to find the row-0 (front) outer wall mesh');
  assert(backMesh, 'expected to find the row-max (back) outer wall mesh');

  const frontY = new THREE.Vector3().setFromMatrixPosition(frontMesh.matrixWorld).y;
  const backY = new THREE.Vector3().setFromMatrixPosition(backMesh.matrixWorld).y;
  // EditorRenderer.js draws row 0 at the top of its SVG and the last row at
  // the bottom; this view's fixed camera renders larger world Y toward the
  // top of the screen (see ThreeDView.js's applyDepthFlip comment) — so row
  // 0 must end up at the larger world Y for the two views to read the same.
  assert(frontY > backY, `expected row 0's world Y (${frontY}) > the last row's (${backY}) after the depth flip`);
});

test('applyDepthFlip leaves left/right (X) untouched', () => {
  const project = asymmetricProject();

  const pieceGroup = new THREE.Group();
  populateScene(pieceGroup, project);
  applyDepthFlip(pieceGroup, project);
  pieceGroup.updateMatrixWorld(true);

  const leftRun = enumerateWallRuns(project.grid, project).find((r) => r.kind === 'v' && r.c === 0);
  const rightRun = enumerateWallRuns(project.grid, project).find((r) => r.kind === 'v' && r.c === project.grid.sx.length);
  const leftMesh = pieceGroup.children.find((m) => m.userData.pieceId === wallPieceId(leftRun));
  const rightMesh = pieceGroup.children.find((m) => m.userData.pieceId === wallPieceId(rightRun));
  assert(leftMesh, 'expected to find the left outer wall mesh');
  assert(rightMesh, 'expected to find the right outer wall mesh');

  const leftX = new THREE.Vector3().setFromMatrixPosition(leftMesh.matrixWorld).x;
  const rightX = new THREE.Vector3().setFromMatrixPosition(rightMesh.matrixWorld).x;
  assert(leftX < rightX, `expected the left wall's world X (${leftX}) to stay left of the right wall's (${rightX})`);
});

run();
