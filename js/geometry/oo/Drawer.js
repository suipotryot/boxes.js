// The drawer (Tiroir in the plan/design discussion): an enclosing sleeve
// Assembly built around another Box's own outer footprint, one side left
// open so that Box can slide in/out of it. Composes the Box it wraps
// (`this.box`) rather than extending it — its own dimensions are DERIVED
// from that Box's footprint, never freely chosen (see the plan's own
// analysis of why Tiroir/Boîte inheritance would have been misleading).
//
// Never overrides build() — Assembly's own shared implementation already
// works unchanged once fed this class's own synthetic grid/project (the
// same "construire() est unique" property the old DrawerBuilder already
// exercised, reusing buildWallPanel/buildBasePlate/buildLid verbatim
// against a synthetic 1-cell grid). Drawer's only real job is synthesizing
// that grid/project before Assembly's constructor runs, and prefixing its
// own ids afterward.
import { createGrid, setSegmentPresent } from '../../model/Grid.js';
import { xAt, yAt, outerBoxHeight } from '../../model/GridQuery.js';
import { Assembly } from './Assembly.js';

// (kind, c, r) of the outer segment to remove for each side of the
// sleeve's own 1x1 grid, plus which axis ('x' = width/sx, 'y' = depth/sy)
// that side sits on.
export const OPEN_SIDE = {
  top: { kind: 'h', c: 0, r: 0, axis: 'y' },
  bottom: { kind: 'h', c: 0, r: 1, axis: 'y' },
  right: { kind: 'v', c: 1, r: 0, axis: 'x' },
  left: { kind: 'v', c: 0, r: 0, axis: 'x' },
};

export const DRAWER_PREFIX = 'drawer:';

/** project.pieceNotches/pieceHoles are keyed by each piece's own FINAL id
 *  (so a main-box wall and a sleeve wall that happen to land on the same
 *  unprefixed wall-${kind}-${c}-${r} never collide) — but Assembly.build()
 *  looks a notch/hole up by the run's own unprefixed id, since it has no
 *  idea it might be building a drawer wall. Remap down to unprefixed keys
 *  before handing them to the sleeve's own synthetic project. */
function unprefixed(map, prefix) {
  const result = {};
  for (const [id, value] of Object.entries(map || {})) {
    if (id.startsWith(prefix)) result[id.slice(prefix.length)] = value;
  }
  return result;
}

export class Drawer extends Assembly {
  constructor(box) {
    const { grid, project } = Drawer.sleeveContext(box);
    super(grid, project);
    this.box = box; // the Box this Drawer wraps and derives its own contour from
  }

  /** The sleeve's own synthetic 1x1 grid + sub-project — sized to clear
   *  `box`'s own real outer footprint (outerBoxHeight, not just wall
   *  height, so the base plate's and any flush lid's own thickness are
   *  accounted for) by `drawer.playMm` on every closed side, flush (no
   *  clearance) on the open side. */
  static sleeveContext(box) {
    const { grid, project } = box;
    const { drawer } = project;
    const innerW = xAt(grid, project, grid.sx.length) + 2 * project.outerThicknessMm;
    const innerD = yAt(grid, project, grid.sy.length) + 2 * project.outerThicknessMm;
    const innerH = outerBoxHeight(grid, project);

    const { kind, c, r, axis } = OPEN_SIDE[drawer.openSide];
    const sleeveW = innerW + (axis === 'x' ? 1 : 2) * drawer.playMm;
    const sleeveD = innerD + (axis === 'y' ? 1 : 2) * drawer.playMm;
    // base & lid always present, never the open side — plus a full extra
    // drawer.thicknessMm beyond "2*playMm on top of the main box's own
    // real height": the sleeve's own lid (always flush) sits with its
    // BOTTOM face one thickness BELOW this line, so without this term the
    // sleeve's own lid would eat into the clearance meant for the main
    // box's own top (see the original DrawerBuilder's own comment on this
    // exact term, verified against real world-space Z bounds there).
    const sleeveH = innerH + 2 * drawer.playMm + drawer.thicknessMm;

    const sleeveGrid = setSegmentPresent(createGrid([sleeveW], [sleeveD]), kind, c, r, false);
    const sleeveProject = {
      ...project,
      outerThicknessMm: drawer.thicknessMm,
      outerHeightMm: sleeveH,
      lid: { enabled: true, insertHeightMm: sleeveH - drawer.thicknessMm }, // always flush
      pieceNotches: unprefixed(project.pieceNotches, DRAWER_PREFIX),
      pieceHoles: unprefixed(project.pieceHoles, DRAWER_PREFIX),
    };
    return { grid: sleeveGrid, project: sleeveProject };
  }

  allPieces() {
    return super.allPieces().map((p) => ({ ...p, id: `${DRAWER_PREFIX}${p.id}` }));
  }
}
