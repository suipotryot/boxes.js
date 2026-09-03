// The box's flat W×D sheet — shared shape behind BasePlate (bottom) and
// Lid (top, when enabled): a perimeter outline (see OuterBoundary.js) plus
// a list of holes. Not called "Panel" — despite the name similarity, its
// own outline() assembly is genuinely different from Panel.outline() (see
// OuterBoundary.js's own header comment on why a wall's 4 edges and a
// plate/lid's 4 sides need different corner handling).
import { outerBoundaryOutline } from './OuterBoundary.js';

export class FlatPanel {
  constructor({ id, kind, thicknessMm, sides, widthMm, depthMm, margins, holes = [] }) {
    this.id = id;
    this.kind = kind;
    this.thicknessGroup = 'outer'; // always — see BasePlateBuilder/LidBuilder, both always outer-group
    this.thicknessMm = thicknessMm;
    this.sides = sides; // {top,right,bottom,left}, each {edge,axisPoint,inward} | null (an open side)
    this.widthMm = widthMm;
    this.depthMm = depthMm;
    this.margins = margins; // {top,right,bottom,left} outward corner margin per present side
    this.holes = holes;
  }

  outline() {
    return outerBoundaryOutline(this.sides, this.widthMm, this.depthMm, this.margins);
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
