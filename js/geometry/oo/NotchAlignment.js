// centerNotches, distributeNotches — the 2 alignment buttons in
// GripNotchEditor.js. A Notch has only ONE meaningful axis (offsetMm,
// along its own edge) — unlike a Hole, its depth is pinned to that edge,
// never a free position to center/distribute — so there's no X/Y split
// here the way HoleAlignment.js has one. Both delegate to the same shared
// axis math (CutoutAlignment.js) that HoleAlignment.js uses.
import { centerOnAxis, distributeOnAxis } from './CutoutAlignment.js';

const start = (n) => n.offsetMm;
const size = (n) => n.widthMm;
const setStart = (n, offsetMm) => n.withChanges({ offsetMm });

export function centerNotches(notches, runLengthMm) {
  return centerOnAxis(notches, runLengthMm, size, setStart);
}

export function distributeNotches(notches) {
  return distributeOnAxis(notches, start, size, setStart);
}
