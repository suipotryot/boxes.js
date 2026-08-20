// The fixed lid (the only lid mode this app supports — see the plan's
// 2026-08-20 scope cut): a flat W×D sheet that joints only with the 4
// OUTER wall runs, at a configurable insertion height (`project.lid`,
// measured like every other height field in this app — the y-coordinate
// of its own *top* face), never with interior dividers (PanelBuilder's
// `lidActive` guard already scopes lid geometry to `thicknessGroup ===
// 'outer'`, and GridQuery.validateLid enforces the lid always sits above
// every interior divider, so there is never anything for it to joint
// against there).
//
// Two cases, both degenerate forms of the exact same underlying idea —
// "the lid is a flat panel meeting every outer wall, like the base plate
// but at a different height" — so both reuse BasePlateBuilder's shared
// perimeter-edge outline builder rather than inventing new geometry:
//   - FLUSH (insertHeightMm === perimeter height): the lid sits exactly
//     at the walls' own top, so it's the base plate's mirror image —
//     `buildOuterEdgeOutline(grid, project)` with notches, and each outer
//     wall's own free edge grows matching protruding tabs instead of
//     staying flat (see PanelBuilder.lidTopEdgePoints).
//   - RECESSED (insertHeightMm < perimeter height): the walls continue
//     above the lid as a rim, so the lid can't reach their edges — instead
//     it protrudes its OWN tabs outward (`buildOuterEdgeOutline(...,
//     {protrude:true})`) to meet a row of enclosed holes cut mid-height
//     into each wall (PanelBuilder.lidHoles).
import { buildOuterEdgeOutline } from './BasePlateBuilder.js';
import { perimeterHeight } from '../model/GridQuery.js';

export function buildLid(grid, project) {
  const { lid } = project;
  if (!lid || !lid.enabled || lid.insertHeightMm == null) return null;

  const flush = Math.abs(lid.insertHeightMm - perimeterHeight(grid, project)) < 1e-6;

  return {
    id: 'lid',
    kind: 'lid',
    thicknessGroup: 'outer',
    thicknessMm: project.outerThicknessMm,
    outline: buildOuterEdgeOutline(grid, project, { protrude: !flush }),
    holes: [],
  };
}
