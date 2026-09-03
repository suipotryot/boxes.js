// The box's floor (Socle in the plan/design discussion): a FlatPanel whose
// outer boundary always uses protrude:false (see OuterBoundary), plus one
// MortiseHole per finger segment of each interior Divider's own bottom
// comb (never touching the boundary — always fully interior, so unlike
// the boundary's own notches these are safe as independent closed holes).
import { FlatPanel } from './FlatPanel.js';

export class BasePlate extends FlatPanel {
  constructor({ thicknessMm, sides, widthMm, depthMm, margins, holes = [] }) {
    super({ id: 'base-plate', kind: 'basePlate', thicknessMm, sides, widthMm, depthMm, margins, holes });
  }
}
