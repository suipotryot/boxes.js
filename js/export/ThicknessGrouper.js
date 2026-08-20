// Groups pieces by their resolved thickness — each group is cut from one
// physical sheet, so every downstream export step (packing, pagination)
// operates per group, never mixing thicknesses onto the same page.
export function groupByThickness(pieces) {
  const groups = new Map();
  for (const piece of pieces) {
    if (!groups.has(piece.thicknessMm)) groups.set(piece.thicknessMm, []);
    groups.get(piece.thicknessMm).push(piece);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([thicknessMm, pieces]) => ({ thicknessMm, pieces }));
}
