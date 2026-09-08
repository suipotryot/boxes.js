// A BasePlatePanel is a FlatPanel, in the fullest sense — no fields or
// behavior of its own beyond fixing id/kind, since there is only ever one
// base plate per box (see Assembly.buildBasePlate for what actually goes
// into building one).
import { FlatPanel } from './FlatPanel.js';

export class BasePlatePanel extends FlatPanel {
  constructor({ thicknessMm, bottomEdge, rightEdge, topEdge, leftEdge, widthMm, depthMm, marginMm, protrude, openSides, holes = [] }) {
    super({ id: 'base-plate', kind: 'basePlate', thicknessMm, bottomEdge, rightEdge, topEdge, leftEdge, widthMm, depthMm, marginMm, protrude, openSides, holes });
  }
}
