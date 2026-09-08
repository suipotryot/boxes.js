// The box's flat W×D piece — shared shape behind BasePlate (bottom) and Lid
// (top, when enabled): a Panel (see Panel.js) whose 4 inherited edges
// (bottomEdge/rightEdge/topEdge/leftEdge) represent the compass sides of a
// rectangular boundary rather than a wall's own socle/free/end roles — see
// COMPASS_TO_FIELD below for the translation.
//
// Genuinely a different outline() algorithm from Panel's own wall-mode one,
// not a rename: a wall's 4 edges naturally meet at their own tips (each
// edge's own extendToTips, decided once at construction — see Panel.js),
// but a flat piece's own side can be entirely open (no wall there — see
// openSides), so its corners must be computed by explicitly FUSING two
// adjacent sides' own margins instead of trusting either edge's own tip.
// That's why this overrides outline() rather than reusing Panel's, even
// though both classes share the same 4 named edge fields.
import { simplifyPolygon } from '../Point.js';
import { Panel } from './Panel.js';

// Which Panel field holds each compass side of a flat piece's own boundary.
// NOT a 1:1 name match: the position a compass side occupies in this
// class's own assembly order (unreversed-first/alongX = "top") is the SAME
// position bottomEdge occupies in Panel's own wall-mode outline() (also
// unreversed-first/alongX) — a wall's socle edge and a flat piece's compass
// north side play the same structural role. Renaming Panel's fields to
// compass would therefore invert a wall's own bottom/top (socle/free)
// semantics; keeping the wall names and translating here instead avoids
// that.
const COMPASS_TO_FIELD = { top: 'bottomEdge', right: 'rightEdge', bottom: 'topEdge', left: 'leftEdge' };

export class FlatPanel extends Panel {
  constructor({
    id, kind, thicknessMm, bottomEdge, rightEdge, topEdge, leftEdge,
    widthMm, depthMm, marginMm, protrude, openSides, holes = [],
  }) {
    super({ id, kind, thicknessGroup: 'outer', thicknessMm, bottomEdge, rightEdge, topEdge, leftEdge, holes });
    this.widthMm = widthMm; // the compartment's own W×D (the un-toothed nominal rectangle)
    this.depthMm = depthMm;
    this.marginMm = marginMm; // how far a real side's own tab reaches/recedes (= project.outerThicknessMm)
    this.protrude = protrude; // true for a recessed lid, false for a base plate/flush lid
    // {top, right, bottom, left} booleans — which compass sides have no
    // real wall run there. Must be given explicitly, NEVER derived from an
    // edge being absent: an open side is still always a real (flush) Edge
    // here (see buildBoundaryEdges in Assembly.js), and it shares the same
    // 0 margin a real side gets when `protrude` is true — margin alone
    // can't tell the two apart. Getting this wrong would silently invert
    // grip-notch cut direction on an open side (its own inward vector is
    // the exact opposite of a real side's).
    this.openSides = openSides;
  }

  /** A flat piece's own outline: unlike Panel's wall-mode outline(),
   *  adjacent sides' corner points are FUSED — combined from both sides'
   *  own margins into one point — rather than trusted from each edge's own
   *  tip, because a side can be open, in which case it contributes 0
   *  margin there regardless of what the other side does. */
  outline() {
    const { widthMm, depthMm, marginMm, protrude, openSides = {} } = this;
    const sign = protrude ? -1 : 1;

    const axisPointFor = {
      top: (u) => ({ x: u, y: 0 }),
      right: (u) => ({ x: widthMm, y: u }),
      bottom: (u) => ({ x: u, y: depthMm }),
      left: (u) => ({ x: 0, y: u }),
    };
    const inwardFor = {
      top: { x: 0, y: openSides.top ? -sign : sign },
      right: { x: openSides.right ? sign : -sign, y: 0 },
      bottom: { x: 0, y: openSides.bottom ? sign : -sign },
      left: { x: openSides.left ? -sign : sign, y: 0 },
    };
    const marginFor = (compass) => (openSides[compass] ? 0 : protrude ? 0 : marginMm);

    const sidePoints = (compass, reverse) => {
      const edge = this[COMPASS_TO_FIELD[compass]];
      const axisPoint = axisPointFor[compass];
      const inward = inwardFor[compass];
      const pts = edge.points().map(({ u, y: val }) => {
        const p = axisPoint(u);
        return { x: p.x + inward.x * val, y: p.y + inward.y * val };
      });
      return reverse ? pts.reverse() : pts;
    };

    const top = sidePoints('top', false);
    const right = sidePoints('right', false);
    const bottom = sidePoints('bottom', true);
    const left = sidePoints('left', true);

    const mLeft = marginFor('left');
    const mRight = marginFor('right');
    const mTop = marginFor('top');
    const mBottom = marginFor('bottom');
    const topLeft = { x: -mLeft, y: -mTop };
    const topRight = { x: widthMm + mRight, y: -mTop };
    const bottomRight = { x: widthMm + mRight, y: depthMm + mBottom };
    const bottomLeft = { x: -mLeft, y: depthMm + mBottom };
    if (top.length) { top[0] = topLeft; top[top.length - 1] = topRight; }
    if (right.length) { right[0] = topRight; right[right.length - 1] = bottomRight; }
    if (bottom.length) { bottom[0] = bottomRight; bottom[bottom.length - 1] = bottomLeft; }
    if (left.length) { left[0] = bottomLeft; left[left.length - 1] = topLeft; }

    return simplifyPolygon([...top, ...right, ...bottom, ...left]);
  }
}
