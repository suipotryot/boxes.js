// The box's flat W×D piece — shared shape behind the base plate (bottom)
// and the lid (top, when enabled), specialized as BasePlatePanel/LidPanel
// (each just fixing id/kind — see those files) and built by Assembly.js's
// own buildBasePlate/buildLid: a Panel (see Panel.js) whose 4 inherited edges
// (bottomEdge/rightEdge/topEdge/leftEdge) represent the compass sides of a
// rectangular boundary rather than a wall's own socle/free/end roles —
// see outline() below: a flat piece's own compass-north side occupies the
// SAME assembly position as a wall's own socle edge, so north reads from
// bottomEdge and south from topEdge (verified against Panel's own
// wall-mode outline()); east/west read from rightEdge/leftEdge directly,
// no inversion there.
//
// Genuinely a different outline() algorithm from Panel's own wall-mode one,
// not a rename: a wall's 4 edges naturally meet at their own tips (each
// edge's own extendToTips, decided once at construction — see Panel.js),
// but a flat piece's own side can be entirely open (no wall there), so its
// corners must be computed by explicitly FUSING two adjacent sides' own
// margins instead of trusting either edge's own tip.
import { simplifyPolygon } from '../Point.js';
import { Panel } from './Panel.js';

function nominalPointAt(compass, u, widthMm, depthMm) {
  if (compass === 'top') return { x: u, y: 0 };
  if (compass === 'right') return { x: widthMm, y: u };
  if (compass === 'bottom') return { x: u, y: depthMm };
  return { x: 0, y: u }; // left
}

function inwardDirection(compass, protrude, isOpenSide) {
  const outward = protrude ? -1 : 1;
  const towardMaterial = isOpenSide ? -outward : outward;
  if (compass === 'top') return { x: 0, y: towardMaterial };
  if (compass === 'bottom') return { x: 0, y: -towardMaterial };
  if (compass === 'right') return { x: -towardMaterial, y: 0 };
  return { x: towardMaterial, y: 0 }; // left
}

function cornerMargin(protrude, isOpenSide, marginMm) {
  return isOpenSide || protrude ? 0 : marginMm;
}

function sideTrace(edge, compass, { widthMm, depthMm, protrude, isOpenSide, reverse }) {
  const inward = inwardDirection(compass, protrude, isOpenSide);
  const points = edge.points().map(({ u, y: reach }) => {
    const nominal = nominalPointAt(compass, u, widthMm, depthMm);
    return { x: nominal.x + inward.x * reach, y: nominal.y + inward.y * reach };
  });
  return reverse ? points.reverse() : points;
}

function fuseCorners(traces, widthMm, depthMm, margins) {
  const topLeft = { x: -margins.left, y: -margins.top };
  const topRight = { x: widthMm + margins.right, y: -margins.top };
  const bottomRight = { x: widthMm + margins.right, y: depthMm + margins.bottom };
  const bottomLeft = { x: -margins.left, y: depthMm + margins.bottom };

  if (traces.top.length) { traces.top[0] = topLeft; traces.top[traces.top.length - 1] = topRight; }
  if (traces.right.length) { traces.right[0] = topRight; traces.right[traces.right.length - 1] = bottomRight; }
  if (traces.bottom.length) { traces.bottom[0] = bottomRight; traces.bottom[traces.bottom.length - 1] = bottomLeft; }
  if (traces.left.length) { traces.left[0] = bottomLeft; traces.left[traces.left.length - 1] = topLeft; }
}

export class FlatPanel extends Panel {
  constructor({
    id, kind, thicknessMm, bottomEdge, rightEdge, topEdge, leftEdge,
    widthMm, depthMm, marginMm, protrude, openSides, holes = [],
  }) {
    super({ id, kind, thicknessGroup: 'outer', thicknessMm, bottomEdge, rightEdge, topEdge, leftEdge, holes });
    this.widthMm = widthMm;
    this.depthMm = depthMm;
    this.marginMm = marginMm;
    this.protrude = protrude;
    this.openSides = openSides;
  }

  outline() {
    const { widthMm, depthMm, marginMm, protrude, openSides = {} } = this;
    const geometryFor = (compass, reverse) => ({ widthMm, depthMm, protrude, isOpenSide: openSides[compass], reverse });

    const traces = {
      top: sideTrace(this.bottomEdge, 'top', geometryFor('top', false)),
      right: sideTrace(this.rightEdge, 'right', geometryFor('right', false)),
      bottom: sideTrace(this.topEdge, 'bottom', geometryFor('bottom', true)),
      left: sideTrace(this.leftEdge, 'left', geometryFor('left', true)),
    };
    const margins = {
      top: cornerMargin(protrude, openSides.top, marginMm),
      right: cornerMargin(protrude, openSides.right, marginMm),
      bottom: cornerMargin(protrude, openSides.bottom, marginMm),
      left: cornerMargin(protrude, openSides.left, marginMm),
    };
    fuseCorners(traces, widthMm, depthMm, margins);

    return simplifyPolygon([...traces.top, ...traces.right, ...traces.bottom, ...traces.left]);
  }
}
