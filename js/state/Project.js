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
    lid: { style: 'none', insertHeightMm: null, playMm: 0.2 },
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
