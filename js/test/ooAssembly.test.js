// Assembly: orchestrates walls + base plate + lid from Grid/Project. This
// file's own end-to-end equivalence coverage (formerly ooBox.test.js/
// ooEquivalence.test.js, comparing against the old procedural pipeline)
// was retired at the step-8 cutover once that pipeline was deleted — see
// the plan. This file instead holds targeted regression tests for bugs
// found post-cutover, exercising Assembly's own exported builders
// directly.
import { test, assert, run } from './testHarness.js';
import { createGrid, setSegmentHeight } from '../model/Grid.js';
import { createDefaultProject } from '../state/Project.js';
import { enumerateWallRuns, heightProfile, heightAt } from '../model/GridQuery.js';
import { buildWallPiece } from '../geometry/oo/Assembly.js';

test('a mortise hole at a T junction is capped by the through-piece\'s own LOCAL height, not just the stem\'s own height — a stem taller than a locally-reduced through-piece must not poke a hole past its edge', () => {
  const project = createDefaultProject();
  project.grid = createGrid([80, 80], [100]); // 2x1: one interior v-divider, T-junctions at its top/bottom ends
  project.outerThicknessMm = 3;
  project.innerThicknessMm = 2;
  project.outerHeightMm = 40;
  project.innerHeightMm = 35; // the stem's own height: taller than the reduced through-height below
  project.grid = setSegmentHeight(project.grid, 'h', 0, 0, 20); // reduce ONLY c=0 of the top outer run

  const topRun = enumerateWallRuns(project.grid, project).find((r) => r.kind === 'h' && r.r === 0);
  const spans = heightProfile(topRun, project.grid, project);
  const uAtJunction = spans[0].uEnd; // the c=0/c=1 boundary, where the divider's top end lands
  const localHeight = heightAt(spans, uAtJunction);
  assert(localHeight === 20, `sanity check: the through-piece's own local height at the junction should be the reduced 20mm, got ${localHeight}`);

  const piece = buildWallPiece(topRun, project.grid, project).toPiece();
  assert(piece.holes.length > 0, 'sanity check: this scenario should actually produce mortise holes to check');
  for (const hole of piece.holes) {
    for (const pt of hole) {
      assert(pt.y <= localHeight + 1e-9, `mortise hole point y=${pt.y} exceeds the through-piece's own local height (${localHeight}) at the junction — it pokes past the piece's own edge`);
    }
  }
});

run();
