// A system-generated notch (EncocheCroisement in the plan) at an X
// crossing between two Dividers — always symmetric, computed purely from
// grid heights, never from a reference to the OTHER crossing piece: the
// depth (h/2, the shorter of the 4 local heights touching the crossing)
// is a pure, order-independent function of data both sides already read
// off the same Grid — see the plan's own "croisement en X" analysis for
// why that's provably safe without a live reference, unlike a finger
// comb's phase (see FingerEdge.js's own comment on that distinction).
//
// Deliberately NOT a Cutout subclass: never user-authored (no text-line
// format, no validation, no persisted storage) — just enough to produce
// its own edge fragment.
import { resolveHeight, resolveThickness } from '../../model/GridQuery.js';

export class HalfLapNotch {
  constructor({ positionMm, widthMm, depthMm }) {
    this.positionMm = positionMm;
    this.widthMm = widthMm;
    this.depthMm = depthMm;
  }

  /** {uStart, uEnd, depth} — spliced into an Edge's own points() exactly
   *  like a Notch's fragment, just as a flat override rather than a
   *  polyline (a half-lap notch is always a plain rectangular cut, no
   *  corner radius concept). */
  toEdgeFragment() {
    const half = this.widthMm / 2;
    return { uStart: this.positionMm - half, uEnd: this.positionMm + half, depth: this.depthMm };
  }

  /** Builds the notch a Divider's own edge needs at one X crossing.
   *  `positionMm` is the crossing's u position along THIS run's own
   *  length (the caller's to compute, e.g. via xAt/yAt relative to the
   *  run's own start — same convention GridQuery.enumerateWallRuns
   *  itself uses). `crossing` is a GridQuery.junctionKindAt (or
   *  crossingAt) result with kind 'crossing' (interior point) — `.seg`
   *  gives the crossing piece's own thickness, `.segs` its two touching
   *  cells' own heights. `ownHeightAtU` is THIS run's own resolved
   *  height at `positionMm` (e.g. via a SmoothEdge/FingerEdge's own
   *  heightProfile — computed independently by each side, on purpose:
   *  see this class's own header comment). */
  static atCrossing(positionMm, crossing, ownHeightAtU, project) {
    const widthMm = resolveThickness(crossing.seg, project);
    const otherHeight = Math.min(...crossing.segs.map((s) => resolveHeight(s, project)));
    const depthMm = Math.min(ownHeightAtU, otherHeight) / 2;
    return new HalfLapNotch({ positionMm, widthMm, depthMm });
  }
}
