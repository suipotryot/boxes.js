// The one and only finger-tiling function in the whole app. Every joint
// (wall corners, T/X junctions, base-plate notches, lid joints) calls this
// and only decides *where* to place the result — nobody re-derives finger
// widths locally. That discipline is what keeps mixed-thickness junctions
// and corner joints consistent with each other.
//
// Tiles [0, length] into: a flush margin, a comb of as many 'finger'
// segments as fit at their *configured* width (fj.fingerMm/spaceMm,
// never stretched or shrunk to force an exact fit), and a trailing flush
// margin — the comb is CENTERED on the edge, so any slack left over after
// fitting the maximum whole number of teeth is split evenly on both
// sides rather than distorting tooth width to consume it exactly.
// `fj.marginMm` is a *minimum* margin: on a short edge that can't fit even
// one tooth without violating it, the margin is relaxed instead of
// producing zero teeth. Segment widths always sum exactly to `length`.

/**
 * @param {number} length total edge length, mm
 * @param {{fingerMm:number, spaceMm:number, marginMm:number, playMm?:number}} fj
 * @param {boolean} startWithFinger whether the comb's first tooth (right after
 *   the leading margin) is a 'finger' (protrudes) or a 'space' (recedes).
 *   Two mating edges must pass opposite values to interlock.
 * @returns {{start:number,length:number,kind:'flush'|'finger'|'space'}[]}
 */
export function fingerEdgePath(length, fj, startWithFinger) {
  const play = Math.min(fj.playMm || 0, fj.fingerMm * 0.5);
  const fingerW = fj.fingerMm - play;
  const spaceW = fj.spaceMm + play;
  const cycle = fingerW + spaceW;

  const margin = Math.min(fj.marginMm, length / 2);
  const usable = length - 2 * margin;

  if (fingerW <= 0 || usable <= 0 || cycle <= 0) {
    return [{ start: 0, length, kind: 'flush' }];
  }

  // As many teeth as fit at their configured width within the usable span
  // — always at least 1 once anything is usable at all.
  const count = Math.max(1, Math.floor((usable + spaceW) / cycle));
  const teethSpan = count * fingerW + (count - 1) * spaceW;

  // Centered: whatever's left over after the teeth is split evenly as
  // flush margin on both sides (always >= `margin` when the teeth fit
  // within `usable`, per the floor above).
  const flush = length - teethSpan;
  const lead = flush / 2;

  const segs = [];
  if (lead > 1e-9) segs.push({ start: 0, length: lead, kind: 'flush' });
  let pos = lead;

  for (let i = 0; i < count * 2 - 1; i++) {
    const isFinger = i % 2 === 0 ? startWithFinger : !startWithFinger;
    const w = isFinger ? fingerW : spaceW;
    segs.push({ start: pos, length: w, kind: isFinger ? 'finger' : 'space' });
    pos += w;
  }

  const trailing = length - pos;
  if (trailing > 1e-9) segs.push({ start: pos, length: trailing, kind: 'flush' });

  return segs;
}

/** Returns a copy of `fj` with marginMm raised to at least minMarginMm.
 *  Used to keep teeth clear of corner posts (e.g. floor teeth must not
 *  land inside the corner relief a base plate already carves out). */
export function withMinMargin(fj, minMarginMm) {
  return { ...fj, marginMm: Math.max(fj.marginMm, minMarginMm) };
}
