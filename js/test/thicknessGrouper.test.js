import { test, assert, run } from './testHarness.js';
import { groupByThickness } from '../export/ThicknessGrouper.js';

function fakePiece(id, thicknessMm) {
  return { id, thicknessMm, outline: [{ x: 0, y: 0 }], holes: [] };
}

test('groups pieces by their thicknessMm', () => {
  const pieces = [fakePiece('a', 3), fakePiece('b', 6), fakePiece('c', 3)];
  const groups = groupByThickness(pieces);
  assert(groups.length === 2, `expected 2 groups, got ${groups.length}`);
  const g3 = groups.find((g) => g.thicknessMm === 3);
  const g6 = groups.find((g) => g.thicknessMm === 6);
  assert(g3.pieces.length === 2 && g3.pieces.map((p) => p.id).sort().join(',') === 'a,c');
  assert(g6.pieces.length === 1 && g6.pieces[0].id === 'b');
});

test('groups are sorted ascending by thickness', () => {
  const pieces = [fakePiece('a', 6), fakePiece('b', 3), fakePiece('c', 9)];
  const groups = groupByThickness(pieces);
  assert(groups.map((g) => g.thicknessMm).join(',') === '3,6,9');
});

test('a single uniform thickness produces exactly one group with all pieces', () => {
  const pieces = [fakePiece('a', 3), fakePiece('b', 3), fakePiece('c', 3)];
  const groups = groupByThickness(pieces);
  assert(groups.length === 1);
  assert(groups[0].pieces.length === 3);
});

test('an empty piece list produces no groups', () => {
  assert(groupByThickness([]).length === 0);
});

run();
