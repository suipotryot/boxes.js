// One flat piece to be cut (Planche in the plan/design discussion): 4 Edge
// instances (its own 4 sides) plus a list of Hole instances, and the two
// methods that turn that into the flat Piece shape every downstream
// consumer (BurnCorrection, the UI, export) already expects unchanged.
//
// Two genuinely different corner algorithms live here, chosen per instance
// via `boundary`: a wall/divider's own 4 edges are trusted to already meet
// at their own tips (outline() below, `boundary` left null — Divider is a
// Panel in this mode with no fields of its own, see Divider.js) — a base
// plate/lid's own 4 edges instead need their corners FUSED from two
// adjacent sides' own margins (flatBoundaryOutline() below, `boundary`
// set), because a side can be entirely open (no wall there at all). These
// aren't a rename of the same computation — a wall's dented tips naturally
// interlock without ever computing a shared corner point, while a flat
// piece's corner must be computed explicitly since one of the two sides
// meeting there might contribute nothing. Formerly two separate classes
// (Panel + FlatPanel, with BasePlate/Lid as its trivial subclasses, and
// OuterBoundary.outerBoundaryOutline as the flat-mode algorithm) — merged
// here once boundary-mode support was proven equivalent to the old
// OuterBoundary implementation.
import { simplifyPolygon } from '../Point.js';

// Which Panel field holds each compass side of a flat piece's own boundary
// (base plate/lid). NOT a 1:1 name match: the position a compass side
// occupies in outline()'s assembly order (unreversed-first/alongX = "top"
// for a flat piece) is the SAME position bottomEdge occupies for a wall
// (also unreversed-first/alongX) — verified against outline()'s own
// unmodified wall-mode branch below. Renaming Panel's fields to compass
// would therefore invert a wall's own bottom/top (socle/free) semantics;
// keeping the wall names and translating here instead avoids that.
const COMPASS_TO_FIELD = { top: 'bottomEdge', right: 'rightEdge', bottom: 'topEdge', left: 'leftEdge' };

export class Panel {
  constructor({ id, kind, thicknessGroup, thicknessMm, bottomEdge, rightEdge, topEdge, leftEdge, boundary = null, holes = [] }) {
    this.id = id;
    this.kind = kind;
    this.thicknessGroup = thicknessGroup;
    this.thicknessMm = thicknessMm;
    this.bottomEdge = bottomEdge;
    this.rightEdge = rightEdge;
    this.topEdge = topEdge;
    this.leftEdge = leftEdge;
    // null => wall mode (outline() below, unchanged). Otherwise
    // {widthMm, depthMm, marginMm, protrude, openSides:{top,right,bottom,left}}
    // => flat-piece mode (base plate/lid): corner points are FUSED from two
    // adjacent sides' own margins instead of trusted from each edge's own
    // tip — see flatBoundaryOutline() below.
    this.boundary = boundary;
    this.holes = holes;
  }

  /** Assembles the 4 edges into one closed contour in this panel's own
   *  (x,y) plane. Each edge's own local (u, value) already carries the
   *  correct sign/baseline for its role (decided at construction time —
   *  see FingerEdge's own comment); this method only knows two purely
   *  structural facts per slot: bottom/top tile along x (their own u IS
   *  x, their value IS y), right/left tile along y instead (their value
   *  IS x, their own u IS y) — and top/left need their point order
   *  reversed to keep the assembled outline non-self-intersecting,
   *  exactly like the old buildWallPanel's own
   *  `[...bottom, ...right, ...top, ...left]` (top/left already reversed
   *  internally there; that reversal moved here since Edge itself is now
   *  role-agnostic). */
  outline() {
    if (this.boundary) return this.flatBoundaryOutline();

    // A null side is simply omitted — not exercised by any real caller yet
    // (every current wall always has all 4 edges), but tolerated so a
    // future structurally-partial piece (half-box, U-shaped assembly) can
    // reuse this same wall-mode branch without a crash. See the plan's D4.
    const alongX = (edge) => (edge ? edge.points().map((p) => ({ x: p.u, y: p.y })) : []);
    const alongY = (edge) => (edge ? edge.points().map((p) => ({ x: p.y, y: p.u })) : []);

    const bottom = alongX(this.bottomEdge);
    const right = alongY(this.rightEdge);
    const top = alongX(this.topEdge).reverse();
    const left = alongY(this.leftEdge).reverse();

    return simplifyPolygon([...bottom, ...right, ...top, ...left]);
  }

  /** A flat piece's own outline (base plate/lid): unlike the wall-mode
   *  branch above, adjacent sides' corner points are FUSED — combined from
   *  both sides' own margins into one point — rather than trusted from
   *  each edge's own tip, because a side can be open (openSides), in which
   *  case it contributes 0 margin there regardless of what the other side
   *  does. Ported from the now-superseded OuterBoundary.outerBoundaryOutline,
   *  reading the 4 edges through COMPASS_TO_FIELD instead of a separate
   *  `sides` dict. `openSides[compass]` must be given explicitly — NEVER
   *  derived from an edge being absent, since an open side is still always
   *  a real (flush) Edge here (see D3/D4 in the plan): the inward vector of
   *  an open side is the exact opposite of a real one on the same compass,
   *  and deriving it wrong would silently invert grip-notch cut direction. */
  flatBoundaryOutline() {
    const { widthMm, depthMm, marginMm, protrude, openSides = {} } = this.boundary;
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

  toPiece() {
    return {
      id: this.id,
      kind: this.kind,
      thicknessGroup: this.thicknessGroup,
      thicknessMm: this.thicknessMm,
      outline: this.outline(),
      holes: this.holes.map((h) => h.polygon()),
    };
  }
}
