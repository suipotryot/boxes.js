import { FlatPanel } from './FlatPanel.js';

export class HorizontalPanel extends FlatPanel {
  constructor({ id, thicknessMm, bottomEdge, rightEdge, topEdge, leftEdge, widthMm, depthMm, marginMm, protrude, openSides, holes = [] }) {
    super({ id, kind: 'horizontalPanel', thicknessMm, bottomEdge, rightEdge, topEdge, leftEdge, widthMm, depthMm, marginMm, protrude, openSides, holes });
  }
}
