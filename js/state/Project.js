import { createGrid } from '../model/Grid.js';

export function createDefaultProject(name = 'Nouveau projet') {
  return {
    id: null,
    name,
    updatedAt: null,
    grid: createGrid([100, 100], [100, 100]),
    outerThicknessMm: 3,
    innerThicknessMm: 3,
    outerHeightMm: 50,
    innerHeightMm: 50,
    burnMm: 0.1,
    fingerJoint: {
      fingerMm: 10,
      spaceMm: 10,
      marginMm: 5,
      playMm: 0.1,
    },
    laserBed: { widthMm: 600, heightMm: 400, spacingMm: 5 },
    lid: { enabled: false, insertHeightMm: null },
    drawer: { enabled: false, playMm: 1, thicknessMm: 3, openSide: 'top' },
  };
}

// Milestone-1 fixture: a single-cell box with no internal dividers, used
// to prove the geometry pipeline produces a correct, simple, non-crossing
// flat-pack before any junction complexity is added.
export function createM1ExampleProject() {
  const project = createDefaultProject('M1 — boîte simple');
  project.grid = createGrid([150], [100]);
  project.outerHeightMm = 50;
  return project;
}

// Milestone-2 fixture: a 2x2 grid of internal dividers, used to prove T
// junctions (each divider meeting the outer perimeter) and the one X
// crossing (where the two dividers meet each other) all produce correct,
// non-self-intersecting flat-pack outlines. Unequal cell sizes so the
// grid is visibly not just a symmetric square split.
export function createM2ExampleProject() {
  const project = createDefaultProject('M2 — jonctions T et X (grille 2×2)');
  project.grid = createGrid([90, 130], [70, 100]);
  project.outerHeightMm = 50;
  project.innerHeightMm = 50;
  return project;
}
