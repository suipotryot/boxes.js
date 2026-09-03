// Shared base for one side of a Panel (Bordure in the plan/design
// discussion — SmoothEdge/FingerEdge below are its two concrete shapes).
//
// An Edge's own local frame is always (u, y): u runs [0, lengthMm] along
// whichever axis this edge tiles along (a wall's own length for its
// bottom/top edges, or its height for its left/right end edges — an Edge
// itself never knows or cares which); y is a magnitude toward this edge's
// mate (0 = flush at this edge's own nominal line), for FingerEdge, or an
// absolute height for SmoothEdge. How that local (u,y) frame rotates/flips
// into a Panel's own 2D outline is deliberately NOT this class's concern —
// see Panel.js (next step) for the per-role placement, the same way
// endEdgePoints/bottomEdgePoints/freeEdgePoints used to each bake in their
// own sign convention independently. Keeping Edge itself sign-agnostic
// means one shared algorithm serves every edge role.
export class Edge {
  constructor(lengthMm, fragments = []) {
    this.lengthMm = lengthMm;
    // Fragments splice an override into a u-range of this edge's own
    // trace — either {uStart, uEnd, points:[{u,y}...]} (a full polyline,
    // e.g. a rounded Notch) or {uStart, uEnd, depth} (a flat override
    // value, e.g. a crossing notch). Never mutated after construction.
    this.fragments = fragments;
  }

  /** u-positions (besides 0 and lengthMm) where this edge's OWN base
   *  value changes, ignoring fragments — e.g. a stepped height profile's
   *  span boundaries, or a finger comb's tooth/gap boundaries. [] for a
   *  constant-value edge. */
  ownBoundaries() {
    return [];
  }

  /** This edge's own value at u, ignoring fragments. */
  baseValueAt(_u) {
    throw new Error('Edge.baseValueAt must be implemented by a subclass');
  }

  /** This edge's full trace: baseValueAt()/ownBoundaries() fused with
   *  `fragments`, fragments taking priority over the base value wherever
   *  they apply. Replaces the "boundary Set, sort, midpoint lookup"
   *  skeleton that used to be reimplemented independently in
   *  bottomEdgePoints/freeEdgePoints/lidTopEdgePoints/edgeNotchPoints. */
  points() {
    const boundarySet = new Set([0, this.lengthMm, ...this.ownBoundaries()]);
    for (const f of this.fragments) {
      boundarySet.add(f.uStart);
      boundarySet.add(f.uEnd);
    }
    const boundaries = [...boundarySet].sort((a, b) => a - b);

    const pts = [];
    for (let i = 0; i < boundaries.length - 1; i++) {
      const uStart = boundaries[i];
      const uEnd = boundaries[i + 1];
      if (uEnd <= uStart) continue;
      const mid = (uStart + uEnd) / 2;
      const fragment = this.fragments.find((f) => mid > f.uStart && mid < f.uEnd);
      if (fragment && fragment.points) {
        for (const p of fragment.points) pts.push(p);
        continue;
      }
      const y = fragment ? fragment.depth : this.baseValueAt(mid);
      pts.push({ u: uStart, y }, { u: uEnd, y });
    }
    return pts;
  }
}
