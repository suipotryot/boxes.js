// The fixed lid (the only lid mode this app supports — see the plan's
// 2026-08-20 scope cut): a flat W×D sheet that joints only with the 4
// OUTER wall runs, at a configurable insertion height (`project.lid`,
// the y-coordinate of its own *bottom* face — the height at which the lid
// rests — unlike every other height field in this app, which gives a
// top-face/free-edge y-coordinate; a lid is a horizontal panel with its
// own thickness straddling the insertion point, and "the height it rests
// at" is the intuitive quantity a user configures it by, matching
// GridQuery.tallestInnerHeight directly instead of needing +thickness
// mental math), never with interior dividers (PanelBuilder's `lidActive`
// guard already scopes lid geometry to `thicknessGroup === 'outer'`, and
// GridQuery.validateLid enforces the lid's bottom face always sits at or
// above every interior divider, so there is never anything for it to
// joint against there).
//
// Two cases, both degenerate forms of the exact same underlying idea —
// "the lid is a flat panel meeting every outer wall, like the base plate
// but at a different height" — so both reuse BasePlateBuilder's shared
// perimeter-edge outline builder rather than inventing new geometry:
//   - FLUSH (its top face, GridQuery.lidTopFace, === perimeter height):
//     the lid sits exactly at the walls' own top, so it's the base
//     plate's mirror image — `buildOuterEdgeOutline(grid, project)` with
//     notches, and each outer wall's own free edge grows matching
//     protruding tabs instead of staying flat (see
//     PanelBuilder.lidTopEdgePoints).
//   - RECESSED (top face < perimeter height): the walls continue above
//     the lid as a rim, so the lid can't reach their edges — instead it
//     protrudes its OWN tabs outward (`buildOuterEdgeOutline(...,
//     {protrude:true})`) to meet a row of enclosed holes cut mid-height
//     into each wall (PanelBuilder.lidHoles).
import { buildOuterEdgeOutline } from './BasePlateBuilder.js';
import { isLidFlush } from '../model/GridQuery.js';
import { holeListFor, holePolygon } from './Hole.js';

export function buildLid(grid, project) {
  const { lid } = project;
  if (!lid || !lid.enabled || lid.insertHeightMm == null) return null;

  const flush = isLidFlush(grid, project, lid.insertHeightMm);

  return {
    id: 'lid',
    kind: 'lid',
    thicknessGroup: 'outer',
    thicknessMm: project.outerThicknessMm,
    outline: buildOuterEdgeOutline(grid, project, { protrude: !flush }),
    holes: holeListFor(project.pieceHoles, 'lid').map(holePolygon),
  };
}
