// planExport is pure (computePieces/groupByThickness/packPieces are all
// pure) — fully Node-testable without a browser, unlike exportProjectSvg
// itself (downloads, DOM serialization), which is verified live instead.
import { test, assert, run } from './testHarness.js';
import { createGrid } from '../model/Grid.js';
import { createDefaultProject } from '../state/Project.js';
import { planExport } from '../export/ExportPipeline.js';

test('planExport groups pages by thickness, matching a mixed-thickness project', () => {
  const project = createDefaultProject();
  project.grid = createGrid([80, 80], [100]); // outer perimeter + 1 interior divider
  project.outerThicknessMm = 3;
  project.innerThicknessMm = 5;
  project.laserBed = { widthMm: 600, heightMm: 400, spacingMm: 5 };
  const plan = planExport(project);
  assert(plan.length === 2, `expected 2 thickness groups (3mm outer, 5mm inner), got ${plan.length}`);
  assert(plan.map((g) => g.thicknessMm).join(',') === '3,5', 'groups should be sorted ascending by thickness');
});

test('every piece of a thickness group appears exactly once across that group\'s pages', () => {
  const project = createDefaultProject();
  project.grid = createGrid([80, 80], [100]);
  project.outerThicknessMm = 3;
  project.innerThicknessMm = 3;
  project.laserBed = { widthMm: 600, heightMm: 400, spacingMm: 5 };
  const plan = planExport(project);
  assert(plan.length === 1, 'a uniform thickness should produce a single group');
  const placedIds = plan[0].pages.flat().map((item) => item.piece.id).sort();
  assert(placedIds.length === 6, `expected 6 pieces (4 outer sides + 1 divider + base plate), got ${placedIds.length}`);
  assert(new Set(placedIds).size === 6, 'every piece should appear exactly once, not duplicated');
});

test('a laser bed too small for everything spills the group across multiple pages', () => {
  const project = createDefaultProject();
  project.grid = createGrid([150], [100]);
  project.outerThicknessMm = 3;
  project.innerThicknessMm = 3;
  project.laserBed = { widthMm: 50, heightMm: 50, spacingMm: 5 }; // deliberately tiny
  const plan = planExport(project);
  assert(plan.length === 1);
  assert(plan[0].pages.length > 1, `expected multiple pages on a tiny laser bed, got ${plan[0].pages.length}`);
});

test('a laser bed large enough for everything produces exactly one page', () => {
  const project = createDefaultProject();
  project.grid = createGrid([150], [100]);
  project.laserBed = { widthMm: 1500, heightMm: 1500, spacingMm: 5 };
  const plan = planExport(project);
  assert(plan.length === 1);
  assert(plan[0].pages.length === 1, `expected 1 page, got ${plan[0].pages.length}`);
});

run();
