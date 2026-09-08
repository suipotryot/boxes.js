// A LidPanel is a FlatPanel, in the fullest sense — no fields or behavior
// of its own beyond fixing id/kind, since there is only ever one lid per
// box (see Assembly.buildLid for what actually goes into building one,
// including its own onTop/recessed mode).
import { FlatPanel } from './FlatPanel.js';

export class LidPanel extends FlatPanel {
  constructor({ thicknessMm, bottomEdge, rightEdge, topEdge, leftEdge, widthMm, depthMm, marginMm, protrude, openSides, holes = [] }) {
    super({ id: 'lid', kind: 'lid', thicknessMm, bottomEdge, rightEdge, topEdge, leftEdge, widthMm, depthMm, marginMm, protrude, openSides, holes });
  }
}
