// The one and only finger-tiling function in the whole app. Every joint
// (wall corners, T/X junctions, base-plate notches, lid joints) calls this
// and only decides *where* to place the result — nobody re-derives finger
// widths locally. That discipline is what keeps mixed-thickness junctions
// and corner joints consistent with each other.
//
// Tiles [0, length] into: a flush margin, then an alternating comb of
// 'finger' / 'space' segments, then a flush margin. Segment widths always
// sum exactly to `length` (the comb is proportionally scaled to fit, never
// left with rounding slack at one end).

/**
 * @param {number} length total edge length, mm
 * @param {{fingerMm:number, spaceMm:number, marginMm:number, playMm?:number}} fj
 * @param {boolean} startWithFinger whether the comb's first tooth (right after
 *   the leading margin) is a 'finger' (protrudes) or a 'space' (recedes).
 *   Two mating edges must pass opposite values to interlock.
 * @returns {{start:number,length:number,kind:'flush'|'finger'|'space'}[]}
 */
export function fingerEdgePath(length, fj, startWithFinger) {
  const margin = Math.min(fj.marginMm, length / 2);
  const usable = length - 2 * margin;
  const cycle = fj.fingerMm + fj.spaceMm;

  if (usable <= 0 || cycle <= 0) {
    return [{ start: 0, length, kind: 'flush' }];
  }

  const count = Math.max(1, Math.round(usable / cycle));
  const unit = usable / count;
  let fingerW = unit * (fj.fingerMm / cycle);
  let spaceW = unit - fingerW;

  const play = Math.min(fj.playMm || 0, fingerW * 0.5);
  fingerW -= play;
  spaceW += play;

  const segs = [];
  let pos = 0;
  if (margin > 0) segs.push({ start: 0, length: margin, kind: 'flush' });
  pos = margin;

  for (let i = 0; i < count * 2; i++) {
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
