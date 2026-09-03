// validateNotch — ported from js/test/gripNotch.test.js's validation
// section. Still reads run/grid/project via the OLD, still-live Grid.js/
// GridQuery.js/PanelBuilder.js (heightProfile/junctionExclusionRanges) —
// see NotchValidation.js's own comment on why that's fine during the
// migration.
import { test, assert, run } from './testHarness.js';
import { createGrid } from '../model/Grid.js';
import { createDefaultProject } from '../state/Project.js';
import { enumerateWallRuns } from '../model/GridQuery.js';
import { Notch } from '../geometry/oo/Notch.js';
import { validateNotch } from '../geometry/oo/NotchValidation.js';

function baseProject() {
  const project = createDefaultProject();
  project.grid = createGrid([150], [100]); // single cell, no interior dividers
  project.outerThicknessMm = 3;
  project.outerHeightMm = 50;
  return project;
}

test('validateNotch: rejects the expected cases, accepts a well-formed one', () => {
  const project = baseProject();
  const run2 = enumerateWallRuns(project.grid, project).find((r) => r.kind === 'h' && r.r === 0);

  assert(!validateNotch(run2, project.grid, project, new Notch({ widthMm: 30, depthMm: 10, offsetMm: -5, radiusMm: 0 })).ok, 'negative offset should be rejected');
  assert(!validateNotch(run2, project.grid, project, new Notch({ widthMm: 0, depthMm: 10, offsetMm: 10, radiusMm: 0 })).ok, 'zero width should be rejected');
  assert(!validateNotch(run2, project.grid, project, new Notch({ widthMm: 30, depthMm: 10, offsetMm: 10, radiusMm: 20 })).ok, 'radius beyond its own max should be rejected');
  assert(!validateNotch(run2, project.grid, project, new Notch({ widthMm: 30, depthMm: 10, offsetMm: 140, radiusMm: 0 })).ok, 'a notch extending past the run\'s own length should be rejected');
  assert(!validateNotch(run2, project.grid, project, new Notch({ widthMm: 30, depthMm: 55, offsetMm: 10, radiusMm: 0 })).ok, 'depth >= local height should be rejected');

  const ok = validateNotch(run2, project.grid, project, new Notch({ widthMm: 30, depthMm: 10, offsetMm: 20, radiusMm: 5 }));
  assert(ok.ok, `expected a well-formed notch to validate, got problems: ${ok.problems.join('; ')}`);
});

test('validateNotch: rejects a notch overlapping a T-junction mortise', () => {
  const project = createDefaultProject();
  project.grid = createGrid([80, 80], [100]); // T junction: interior divider at c=1
  const run2 = enumerateWallRuns(project.grid, project).find((r) => r.kind === 'h' && r.r === 0);
  const overlapping = validateNotch(run2, project.grid, project, new Notch({ widthMm: 20, depthMm: 5, offsetMm: 75, radiusMm: 0 }));
  assert(!overlapping.ok, 'a notch straddling the T-junction mortise should be rejected');
});

test('validateNotch: rejects two sibling notches on the same wall that overlap, accepts disjoint ones', () => {
  const project = baseProject();
  const run2 = enumerateWallRuns(project.grid, project).find((r) => r.kind === 'h' && r.r === 0);
  const a = new Notch({ widthMm: 20, depthMm: 5, offsetMm: 10, radiusMm: 0 });

  const overlappingSibling = new Notch({ widthMm: 20, depthMm: 5, offsetMm: 25, radiusMm: 0 }); // [25,45) overlaps [10,30)
  const overlapResult = validateNotch(run2, project.grid, project, a, [overlappingSibling]);
  assert(!overlapResult.ok, 'overlapping sibling notches should be rejected');
  assert(overlapResult.problems.some((p) => p.includes('chevauche une autre encoche')));

  const disjointSibling = new Notch({ widthMm: 20, depthMm: 5, offsetMm: 40, radiusMm: 0 }); // [40,60) does not overlap [10,30)
  const disjointResult = validateNotch(run2, project.grid, project, a, [disjointSibling]);
  assert(disjointResult.ok, `expected disjoint sibling notches to validate, got: ${disjointResult.problems.join('; ')}`);
});

run();
