import { test, assert, run } from './testHarness.js';
import { imagePlaneOf, IMAGE_LIFT_MM } from '../geometry/ImagePlane3D.js';
import { Box } from '../geometry/oo/Box.js';
import { createGrid } from '../model/Grid.js';
import { createDefaultProject } from '../state/Project.js';
import { computePiecePlacement3D, toWorld } from '../geometry/PiecePlacement3D.js';

const piece = { thicknessMm: 3 };
const image = { xMm: 10, yMm: 20, widthMm: 40, heightMm: 10 };

test('imagePlaneOf: should center the plane on the middle of the image and keep its size', () => {
  const plane = imagePlaneOf(piece, image);
  assert(plane.centerX === 30 && plane.centerY === 25, `got ${JSON.stringify(plane)}`);
  assert(plane.widthMm === 40 && plane.heightMm === 10, `got ${JSON.stringify(plane)}`);
});

test('imagePlaneOf: should lift the plane just above the outer face of the piece', () => {
  assert(imagePlaneOf(piece, image).offsetZ === 3 + IMAGE_LIFT_MM, 'expected the plane above the face');
});

function distanceFromBoxCenterInPlan(point, center) {
  return Math.hypot(point.x - center.x, point.y - center.y);
}

test('imagePlaneOf: should put the plane of every outer wall outside the box', () => {
  const project = createDefaultProject();
  project.grid = createGrid([50, 50], [50, 50]);
  const outerWalls = Box.fromProject(project).allPiecesBurnCorrected().filter((p) => p.kind === 'wall' && p.thicknessGroup === 'outer');
  assert(outerWalls.length === 4, `expected 4 outer wall pieces, got ${outerWalls.length}`);
  const center = { x: 50, y: 50 };
  for (const wall of outerWalls) {
    const placement = computePiecePlacement3D(project.grid, project, wall);
    const plane = imagePlaneOf(wall, { xMm: 0, yMm: 0, widthMm: 10, heightMm: 10 });
    const planePoint = toWorld(placement, { x: plane.centerX, y: plane.centerY, z: plane.offsetZ });
    const innerFacePoint = toWorld(placement, { x: plane.centerX, y: plane.centerY, z: 0 });
    assert(distanceFromBoxCenterInPlan(planePoint, center) > distanceFromBoxCenterInPlan(innerFacePoint, center), `wall ${wall.id} would show its image inside the box`);
  }
});

run();
