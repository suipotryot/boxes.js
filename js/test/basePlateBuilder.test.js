// M4: interior dividers must carve matching finger holes into the base
// plate, sized by *their own* resolved thickness — this is what makes a
// mixed outer/inner thickness setup ("fond+bords vs. cloisons internes")
// actually assemble, not just render without crashing.
import { test, assert, assertClose, run } from './testHarness.js';
import { createGrid } from '../model/Grid.js';
import { createDefaultProject } from '../state/Project.js';
import { buildBasePlate } from '../geometry/BasePlateBuilder.js';
import { burnCorrect } from '../geometry/BurnCorrection.js';

function holeWidth(hole) {
  const xs = hole.map((p) => p.x);
  return Math.max(...xs) - Math.min(...xs);
}
function holeHeight(hole) {
  const ys = hole.map((p) => p.y);
  return Math.max(...ys) - Math.min(...ys);
}
function segmentsIntersect(p1, p2, p3, p4) {
  const cross = (a, b) => a.x * b.y - a.y * b.x;
  const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
  const d1 = cross(sub(p4, p3), sub(p1, p3));
  const d2 = cross(sub(p4, p3), sub(p2, p3));
  const d3 = cross(sub(p2, p1), sub(p3, p1));
  const d4 = cross(sub(p2, p1), sub(p4, p1));
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}
function isSimplePolygon(points) {
  const n = points.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const shareVertex = j === i || (j + 1) % n === i || j === (i + 1) % n;
      if (shareVertex) continue;
      if (segmentsIntersect(points[i], points[(i + 1) % n], points[j], points[(j + 1) % n])) return false;
    }
  }
  return true;
}

test('a single-cell box (no interior dividers) has no base plate holes', () => {
  const project = createDefaultProject();
  project.grid = createGrid([150], [100]);
  const plate = buildBasePlate(project.grid, project);
  assert(plate.holes.length === 0, 'a box with no dividers should have no base plate holes');
});

test('an interior divider carves finger holes into the base plate, sized by its own resolved thickness', () => {
  const project = createDefaultProject();
  project.grid = createGrid([80, 80], [100]); // one interior vertical divider at c=1
  project.outerThicknessMm = 3;
  project.innerThicknessMm = 5;
  const plate = buildBasePlate(project.grid, project);
  assert(plate.holes.length > 0, 'the interior divider should produce base plate holes');
  for (const hole of plate.holes) {
    assertClose(holeWidth(hole), 5, 1e-9, 'hole width should equal the divider\'s own (inner) thickness, not the outer/mate thickness');
    assert(isSimplePolygon(hole), 'each hole should be a simple, closed rectangle');
  }
});

test('base plate outline and holes stay simple and non-overlapping after burn correction, with a 2x2 grid and mixed thicknesses', () => {
  const project = createDefaultProject();
  project.grid = createGrid([90, 130], [70, 100]); // T-junctions + one X crossing
  project.outerThicknessMm = 3;
  project.innerThicknessMm = 6;
  const plate = burnCorrect(buildBasePlate(project.grid, project), project.burnMm);
  assert(isSimplePolygon(plate.outline), 'burn-corrected outline should stay simple');
  for (const hole of plate.holes) assert(isSimplePolygon(hole), 'each burn-corrected hole should stay simple');

  // Burn shrinks holes inward (less material removed than the nominal
  // finger size) — a sign-flip regression would grow them instead.
  for (const hole of plate.holes) {
    const w = holeWidth(hole);
    const h = holeHeight(hole);
    const smallerDim = Math.min(w, h);
    assert(smallerDim < project.innerThicknessMm, `burn-corrected hole's narrow dimension (${smallerDim}) should be smaller than the nominal thickness (${project.innerThicknessMm})`);
  }
});

run();
