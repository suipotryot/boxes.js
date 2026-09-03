// A Divider (Cloison) is a Panel, in the fullest sense — no fields of its
// own at all. What distinguishes it is never its shape, only how Box
// builds it (reading Grid/GridQuery for this run — see the plan's own
// "Cloison extends Planche" analysis): a Divider's own bottom/free edges,
// and any HalfLapNotch fragments it receives at X crossings, are all
// decided by the builder, never by this class.
import { Panel } from './Panel.js';

export class Divider extends Panel {}
