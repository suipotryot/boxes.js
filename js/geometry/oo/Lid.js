// The box's fixed lid (Plafond in the plan/design discussion): a
// FlatPanel, flush (protrude:false, mirrors the base plate exactly) or
// recessed (protrude:true, its own tabs poke outward into holes cut
// mid-height into the walls — see PanelBuilder's lidHoles, not yet
// ported). Never gets divider holes — a lid only ever joints with the
// OUTER walls (GridQuery.validateLid guarantees the lid's own bottom face
// clears every interior divider, so there's structurally nothing for it
// to joint against there).
import { FlatPanel } from './FlatPanel.js';

export class Lid extends FlatPanel {
  constructor({ thicknessMm, sides, widthMm, depthMm, margins, holes = [] }) {
    super({ id: 'lid', kind: 'lid', thicknessMm, sides, widthMm, depthMm, margins, holes });
  }
}
