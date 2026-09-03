// The main box (Boîte in the plan/design discussion): an Assembly whose
// grid the user configures directly (dimensions freely chosen), as opposed
// to Drawer (not yet built), whose own grid is instead derived from the
// Box it wraps. Composes an optional Drawer rather than being one.
import { outerBoxWidth, outerBoxHeight, outerBoxDepth } from '../../model/GridQuery.js';
import { burnCorrect } from '../BurnCorrection.js';
import { Assembly } from './Assembly.js';

export class Box extends Assembly {
  constructor(grid, project) {
    super(grid, project);
    this.widthMm = outerBoxWidth(grid, project);
    this.heightMm = outerBoxHeight(grid, project);
    this.depthMm = outerBoxDepth(grid, project);
    this.drawer = null; // composed, not inherited — see the plan's own Tiroir analysis
  }

  static fromProject(project) {
    return new Box(project.grid, project).build();
  }

  /** Every piece this Box (and its Drawer, if any) produces, burn-corrected
   *  — the OO replacement for PieceFactory.computePieces(project). */
  allPiecesBurnCorrected() {
    const pieces = [...this.allPieces()];
    if (this.drawer) pieces.push(...this.drawer.allPieces());
    return pieces.map((p) => burnCorrect(p, this.project.burnMm));
  }
}
