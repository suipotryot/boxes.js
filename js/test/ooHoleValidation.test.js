// validateHoleInRect / validateWallHole — ported from js/test/hole.test.js's
// validation sections. Still reads run/grid/project via the OLD, still-live
// Grid.js/GridQuery.js/PanelBuilder.js (heightProfile/heightAt) — see
// HoleValidation.js's own comment on why that's fine during the migration.
import { test, assert, run } from './testHarness.js';
import { createGrid } from '../model/Grid.js';
import { createDefaultProject } from '../state/Project.js';
import { enumerateWallRuns } from '../model/GridQuery.js';
import { Hole } from '../geometry/oo/Hole.js';
import { validateHoleInRect, validateWallHole, wallHoleSpan } from '../geometry/oo/HoleValidation.js';

function baseProject() {
  const project = createDefaultProject();
  project.grid = createGrid([150], [100]); // single cell, no interior dividers
  project.outerThicknessMm = 3;
  project.outerHeightMm = 50;
  return project;
}

test('validateHoleInRect: rejects non-positive dimensions', () => {
  assert(!validateHoleInRect(100, 100, new Hole({ xMm: 10, yMm: 10, widthMm: 0, heightMm: 10, radiusMm: 0 })).ok, 'zero width should be rejected');
  assert(!validateHoleInRect(100, 100, new Hole({ xMm: 10, yMm: 10, widthMm: 10, heightMm: -5, radiusMm: 0 })).ok, 'negative height should be rejected');
});

test('validateHoleInRect: rejects a radius beyond its own geometric max', () => {
  const result = validateHoleInRect(100, 100, new Hole({ xMm: 10, yMm: 10, widthMm: 20, heightMm: 10, radiusMm: 8 }));
  assert(!result.ok, 'a radius beyond min(width,height)/2 (=5 here) should be rejected');
});

test('validateHoleInRect: rejects each of the 4 edge-margin violations (2mm minimum), accepts a well-formed hole', () => {
  const rectW = 100, rectH = 60;
  assert(!validateHoleInRect(rectW, rectH, new Hole({ xMm: 1, yMm: 10, widthMm: 20, heightMm: 10, radiusMm: 0 })).ok, 'too close to the left edge should be rejected');
  assert(!validateHoleInRect(rectW, rectH, new Hole({ xMm: 10, yMm: 1, widthMm: 20, heightMm: 10, radiusMm: 0 })).ok, 'too close to the bottom edge should be rejected');
  assert(!validateHoleInRect(rectW, rectH, new Hole({ xMm: 79.5, yMm: 10, widthMm: 20, heightMm: 10, radiusMm: 0 })).ok, 'too close to the right edge should be rejected');
  assert(!validateHoleInRect(rectW, rectH, new Hole({ xMm: 10, yMm: 49.5, widthMm: 20, heightMm: 10, radiusMm: 0 })).ok, 'too close to the top edge should be rejected');

  const ok = validateHoleInRect(rectW, rectH, new Hole({ xMm: 10, yMm: 10, widthMm: 20, heightMm: 10, radiusMm: 2 }));
  assert(ok.ok, `expected a well-formed hole to validate, got problems: ${ok.problems.join('; ')}`);
});

test('validateHoleInRect: rejects two sibling holes on the same piece that overlap, accepts disjoint ones', () => {
  const a = new Hole({ xMm: 10, yMm: 10, widthMm: 20, heightMm: 20, radiusMm: 0 });
  const overlappingSibling = new Hole({ xMm: 25, yMm: 15, widthMm: 20, heightMm: 20, radiusMm: 0 }); // [25,45)x[15,35) overlaps [10,30)x[10,30)
  const overlapResult = validateHoleInRect(100, 100, a, [overlappingSibling]);
  assert(!overlapResult.ok, 'overlapping sibling holes should be rejected');
  assert(overlapResult.problems.some((p) => p.includes('chevauche un autre trou')));

  const disjointSibling = new Hole({ xMm: 40, yMm: 10, widthMm: 20, heightMm: 20, radiusMm: 0 }); // [40,60) does not overlap [10,30)
  const disjointResult = validateHoleInRect(100, 100, a, [disjointSibling]);
  assert(disjointResult.ok, `expected disjoint sibling holes to validate, got: ${disjointResult.problems.join('; ')}`);
});

test('validateWallHole: accepts a well-formed hole on an ordinary outer wall, using the run\'s own length/height as the rect', () => {
  const project = baseProject();
  const run2 = enumerateWallRuns(project.grid, project).find((r) => r.kind === 'h' && r.r === 0);
  const ok = validateWallHole(run2, project.grid, project, new Hole({ xMm: 20, yMm: 10, widthMm: 30, heightMm: 15, radiusMm: 0 }));
  assert(ok.ok, `expected a well-formed wall hole to validate, got problems: ${ok.problems.join('; ')}`);
});

test('validateWallHole: rejects a hole that would poke past the wall\'s own local height', () => {
  const project = baseProject(); // outerHeightMm = 50
  const run2 = enumerateWallRuns(project.grid, project).find((r) => r.kind === 'h' && r.r === 0);
  const tooTall = validateWallHole(run2, project.grid, project, new Hole({ xMm: 20, yMm: 10, widthMm: 30, heightMm: 45, radiusMm: 0 }));
  assert(!tooTall.ok, 'a hole reaching past the wall\'s own local height (50mm) minus the 2mm margin should be rejected');
});

test('wallHoleSpan: a hole entirely inside a constant-height zone reports that height as its containing span', () => {
  const project = baseProject(); // outerHeightMm = 50, single cell, no interior dividers -> one constant span
  const run2 = enumerateWallRuns(project.grid, project).find((r) => r.kind === 'h' && r.r === 0);
  const { height, containingSpan } = wallHoleSpan(run2, project.grid, project, new Hole({ xMm: 20, yMm: 10, widthMm: 30, heightMm: 15, radiusMm: 0 }));
  assert(height === 50, `expected the wall's own outer height (50), got ${height}`);
  assert(containingSpan != null, 'a hole fully inside one span should resolve a containing span');
});

run();
