// One flat piece to be cut (Planche in the plan/design discussion): 4
// Edge instances (its own 4 sides) plus a list of Hole instances, and the
// two methods that turn that into the flat Piece shape every downstream
// consumer (BurnCorrection, the UI, export) already expects unchanged.
import { simplifyPolygon } from '../Point.js';

export class Panel {
  constructor({ id, kind, thicknessGroup, thicknessMm, bottomEdge, rightEdge, topEdge, leftEdge, holes = [] }) {
    this.id = id;
    this.kind = kind;
    this.thicknessGroup = thicknessGroup;
    this.thicknessMm = thicknessMm;
    this.bottomEdge = bottomEdge;
    this.rightEdge = rightEdge;
    this.topEdge = topEdge;
    this.leftEdge = leftEdge;
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
    const alongX = (edge) => edge.points().map((p) => ({ x: p.u, y: p.y }));
    const alongY = (edge) => edge.points().map((p) => ({ x: p.y, y: p.u }));

    const bottom = alongX(this.bottomEdge);
    const right = alongY(this.rightEdge);
    const top = alongX(this.topEdge).reverse();
    const left = alongY(this.leftEdge).reverse();

    return simplifyPolygon([...bottom, ...right, ...top, ...left]);
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
