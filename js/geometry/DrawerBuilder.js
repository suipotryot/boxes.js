// The "boîte en tiroir" (drawer) feature: an enclosing sleeve box built
// around the current box's own outer footprint, with one side left open so
// the current box can slide in/out of it like a drawer. Built as an
// entirely independent single-cell Grid (its own tiny box, own thickness)
// rather than any modification to the current box's own grid/pieces — the
// two boxes never joint against each other, only clear each other by
// `playMm`.
//
// The sleeve is always base + lid + 3 of its own 4 walls (never 4 walls
// with no lid) — all four `openSide` choices (top/bottom/right/left) name a
// wall in the SAME horizontal plane; the base and lid are never the open
// side. This is what makes it a genuine drawer (slides out horizontally)
// rather than a lid-less sleeve (lifted out vertically), and it's why the
// piece count is always exactly 5 regardless of which side is open.
//
// Reuses the exact same builders the main box's own pieces go through
// (buildWallPanel/buildBasePlate/buildLid) against this synthetic grid —
// no new corner-joint or finger-tiling logic. What already made this work
// with zero further changes: GridQuery.enumerateWallRuns skips absent
// segments (no run → no wall piece on the open side),
// GridQuery.perpendicularMatesAtPoint filters on `.present` (an open
// side's neighboring walls see 0 mates at that corner), and
// PanelBuilder.endEdgePoints already has a `mateProtrusion <= 0` branch
// that degrades to a plain straight, comb-free edge there — exactly a
// flush corner with nothing to joint against. The one genuinely new piece
// (BasePlateBuilder.buildOuterEdgeOutline's per-side corner margin, see
// that file) is what makes the base plate/lid's own edge land flush with
// the open side too, instead of overhanging by the sleeve's own wall
// thickness with nothing there to justify it.
import { createGrid, setSegmentPresent } from '../model/Grid.js';
import { enumerateWallRuns, xAt, yAt, outerBoxWidth, outerBoxDepth, outerBoxHeight } from '../model/GridQuery.js';
import { buildWallPanel } from './PanelBuilder.js';
import { buildBasePlate } from './BasePlateBuilder.js';
import { buildLid } from './LidBuilder.js';

// (kind, c, r) of the outer segment to remove for each side of a 1x1 grid,
// plus which axis ('x' = width/sx, 'y' = depth/sy) that side sits on. The
// open axis gets clearance (`playMm`) only at its closed end — the open
// end is flush with whatever sits just inside it, no clearance added
// there since there's no wall to clear. The other (fully closed) axis
// gets clearance at both ends, same as the height axis (base/lid, never
// the open side).
const OPEN_SIDE = {
  top: { kind: 'h', c: 0, r: 0, axis: 'y' },
  bottom: { kind: 'h', c: 0, r: 1, axis: 'y' },
  right: { kind: 'v', c: 1, r: 0, axis: 'x' },
  left: { kind: 'v', c: 0, r: 0, axis: 'x' },
};

// Which of OPEN_SIDE's two names per axis sits at the grid's own c=0/r=0
// (minimum) end, vs the c=cols/r=rows (maximum) end — needed by both
// computeDrawerOffset and computeDrawerSlideVector below to know which
// direction is "toward the opening".
const OPEN_AT_MIN = new Set(['top', 'left']);

// ':' rather than '-' as the prefix separator: SvgPath.pieceLabel parses a
// wall piece's id with a positional `id.split('-')` (matching
// PanelBuilder.wallPieceId's own `wall-${kind}-${c}-${r}` format) — an
// extra '-'-delimited token in front of that would shift every index and
// corrupt the label (confirmed live: "Paroi WALLv,0" instead of "Paroi
// V0,0"). ':' keeps the id unique across the two boxes' pieces without
// perturbing that split.
export const DRAWER_PREFIX = 'drawer:';

// project.pieceNotches is keyed by each piece's own FINAL id (so a main-box
// wall and a sleeve wall that happen to land on the same unprefixed
// wall-${kind}-${c}-${r} never collide) — but PanelBuilder.buildWallPanel
// always looks a notch up by the run's own unprefixed wallPieceId(), since
// it has no idea it might be building a drawer wall. Remap down to
// unprefixed keys before handing pieceNotches to buildWallPanel via
// sleeveProject, so a notch stored under e.g. "drawer:wall-h-0-0" is found
// by the run whose own id is "wall-h-0-0".
function drawerPieceNotches(pieceNotches) {
  const result = {};
  for (const [id, notch] of Object.entries(pieceNotches || {})) {
    if (id.startsWith(DRAWER_PREFIX)) result[id.slice(DRAWER_PREFIX.length)] = notch;
  }
  return result;
}

// Same remap as drawerPieceNotches above, for project.pieceHoles — a hole
// stored under e.g. "drawer:base-plate" is found by buildBasePlate's own
// unprefixed 'base-plate' lookup via sleeveProject.
function drawerPieceHoles(pieceHoles) {
  const result = {};
  for (const [id, holes] of Object.entries(pieceHoles || {})) {
    if (id.startsWith(DRAWER_PREFIX)) result[id.slice(DRAWER_PREFIX.length)] = holes;
  }
  return result;
}

// The sleeve's own synthetic grid + sub-project, split out of
// buildDrawerBox so PieceContext.js can resolve a single drawer wall's own
// run/height context (for the grip-notch UI) without duplicating this
// sizing math. Returns null when the drawer is disabled, same as
// buildDrawerBox itself.
export function buildSleeveContext(grid, project) {
  const { drawer } = project;
  if (!drawer || !drawer.enabled) return null;

  const innerW = xAt(grid, project, grid.sx.length) + 2 * project.outerThicknessMm;
  const innerD = yAt(grid, project, grid.sy.length) + 2 * project.outerThicknessMm;
  // The main box's REAL outer height (base plate + walls + a flush lid),
  // not just its wall height — perimeterHeight alone used to leave the
  // base plate's (and any flush lid's) own thickness unaccounted for,
  // undersizing the sleeve by that much on this axis. See
  // GridQuery.outerBoxHeight.
  const innerH = outerBoxHeight(grid, project);

  const { kind, c, r, axis } = OPEN_SIDE[drawer.openSide];
  const sleeveW = innerW + (axis === 'x' ? 1 : 2) * drawer.playMm;
  const sleeveD = innerD + (axis === 'y' ? 1 : 2) * drawer.playMm;
  // base & lid always present, never the open side — plus a full extra
  // drawer.thicknessMm beyond the naive "2*playMm on top of the main
  // box's own real height" figure: the sleeve's own lid (`lid` below,
  // always flush) sits with its BOTTOM face one thickness BELOW this
  // sleeveH line (see PanelBuilder.lidTopEdgePoints — a flush lid's tabs
  // land exactly on this line, never past it, so the line itself is the
  // lid's OWN TOP, not its underside). Without this extra term, the
  // sleeve's own lid would physically eat drawer.thicknessMm out of the
  // playMm clearance intended for the main box's own top, and with
  // drawer.thicknessMm >= playMm (the common case) the two boxes would
  // actually collide there — confirmed directly by computing both boxes'
  // real world-space Z bounds via PiecePlacement3D, not just asserted.
  const sleeveH = innerH + 2 * drawer.playMm + drawer.thicknessMm;

  const sleeveGrid = setSegmentPresent(createGrid([sleeveW], [sleeveD]), kind, c, r, false);

  const sleeveProject = {
    ...project,
    outerThicknessMm: drawer.thicknessMm,
    outerHeightMm: sleeveH,
    lid: { enabled: true, insertHeightMm: sleeveH - drawer.thicknessMm }, // always flush
    pieceNotches: drawerPieceNotches(project.pieceNotches),
    pieceHoles: drawerPieceHoles(project.pieceHoles),
  };

  return { sleeveGrid, sleeveProject };
}

// World-space translation that positions the sleeve built by
// buildDrawerBox (whose own pieces are otherwise placed in their own local
// frame, starting at their own (0,0,0) — see PiecePlacement3D.js, exactly
// like the main box) against the main box: playMm clearance on every side
// the sleeve stays closed on, flush (0 clearance) on the open side, so the
// two boxes' cavities actually line up once both are placed in the SAME 3D
// world space.
//
// X/Y: every main-box piece already sits directly in the xAt/yAt frame
// with no translation of its own — the outer wall's own material is what
// pushes a coordinate as far as -outerThicknessMm, so that IS the main
// box's own true minimum X/Y face (see PiecePlacement3D.js), not 0.
//
// Z: baseZ (=drawer.thicknessMm, the sleeve's own outerThicknessMm) is the
// world Z of the sleeve's own "v=0" convention (a wall's own bottom mating
// edge, see PiecePlacement3D.js) — the reference sleeveH is measured from.
// Anchoring the sleeve's v=0 a full (drawer.thicknessMm + playMm) below the
// main box's own floor (z=0) is what keeps the BOTTOM clearance exactly
// playMm (the base plate's own material, drawer.thicknessMm, sits below
// v=0; the empty air gap above that, up to the main box's own floor, is
// what's left: playMm). The identical playMm gap at the TOP falls out for
// free from this same anchor, but only because sleeveH itself (see
// buildSleeveContext) already includes an extra +drawer.thicknessMm term
// to account for the sleeve's own flush lid eating that same thickness out
// of its underside — this function doesn't need to know that, it only
// needs the bottom anchor above; verified directly by computing both
// boxes' real world-space Z bounds via PiecePlacement3D (not just derived
// algebraically — an earlier derivation here was wrong until it was
// checked against buildSleeveContext's actual sleeveH, see that function's
// own comment).
export function computeDrawerOffset(project) {
  const { drawer, outerThicknessMm } = project;
  const mainMin = -outerThicknessMm;
  const closed = mainMin - drawer.playMm;
  const { axis } = OPEN_SIDE[drawer.openSide];
  const openAtMin = OPEN_AT_MIN.has(drawer.openSide);
  return {
    x: axis === 'x' ? (openAtMin ? mainMin : closed) : closed,
    y: axis === 'y' ? (openAtMin ? mainMin : closed) : closed,
    z: -(drawer.thicknessMm + drawer.playMm),
  };
}

// Translation that slides the MAIN box (never the sleeve, which stays put)
// along the open axis, away from the closed side, by `openT` (0 = closed/
// nested, 1 = fully clear of the sleeve — its own extent on that axis) —
// the 3D preview's "open the drawer" slider. Pure UI-driven positioning,
// not a placement PiecePlacement3D itself needs to know about; the caller
// (ThreeJsScene.js) adds this on top of every non-sleeve piece's own
// placement via PiecePlacement3D.translatePlacement.
export function computeDrawerSlideVector(grid, project, openT) {
  const { drawer } = project;
  const { axis } = OPEN_SIDE[drawer.openSide];
  const sign = OPEN_AT_MIN.has(drawer.openSide) ? -1 : 1;
  const distance = (axis === 'x' ? outerBoxWidth(grid, project) : outerBoxDepth(grid, project)) * openT * sign;
  return { x: axis === 'x' ? distance : 0, y: axis === 'y' ? distance : 0, z: 0 };
}

export function buildDrawerBox(grid, project) {
  const ctx = buildSleeveContext(grid, project);
  if (!ctx) return null;
  const { sleeveGrid, sleeveProject } = ctx;

  const pieces = enumerateWallRuns(sleeveGrid, sleeveProject)
    .map((run) => buildWallPanel(run, sleeveGrid, sleeveProject, true));
  pieces.push(buildBasePlate(sleeveGrid, sleeveProject));
  pieces.push(buildLid(sleeveGrid, sleeveProject));

  return pieces.map((p) => ({ ...p, id: `${DRAWER_PREFIX}${p.id}` }));
}
