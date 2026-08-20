import { test, assert, assertClose, run } from './testHarness.js';
import { packShelves } from '../export/ShelfPacker.js';

// A simple axis-aligned rectangle outline, (0,0) to (w,h) — pieceBounds()
// reads straight off piece.outline, so this is all packShelves needs.
function rectPiece(id, w, h) {
  return {
    id,
    outline: [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }],
    holes: [],
  };
}

test('small pieces that all fit within one page end up on a single page', () => {
  const pieces = [rectPiece('a', 40, 40), rectPiece('b', 30, 30), rectPiece('c', 20, 20)];
  const pages = packShelves(pieces, 100, 100, 5);
  assert(pages.length === 1, `expected 1 page, got ${pages.length}`);
  assert(pages[0].length === 3, `expected all 3 pieces on that page, got ${pages[0].length}`);
});

test('every input piece appears exactly once across all pages', () => {
  const pieces = [rectPiece('a', 40, 40), rectPiece('b', 30, 30), rectPiece('c', 20, 20), rectPiece('d', 25, 60)];
  const pages = packShelves(pieces, 60, 60, 5);
  const allIds = pages.flat().map((item) => item.piece.id).sort();
  assert(allIds.join(',') === 'a,b,c,d', `expected every piece placed exactly once, got ${allIds.join(',')}`);
});

test('a piece that no longer fits the current shelf width wraps to a new shelf on the SAME page', () => {
  // page 50 wide: two 30-wide pieces can't share a shelf (30+30+spacing > 50),
  // but the page is tall enough (200) for both to fit as separate shelves.
  const pieces = [rectPiece('a', 30, 10), rectPiece('b', 30, 10)];
  const pages = packShelves(pieces, 50, 200, 5);
  assert(pages.length === 1, `expected both to still fit on 1 page (different shelves), got ${pages.length}`);
  const a = pages[0].find((i) => i.piece.id === 'a');
  const b = pages[0].find((i) => i.piece.id === 'b');
  assert(a.y !== b.y, 'the two pieces should land on different shelves (different y)');
});

test('a shelf that no longer fits the remaining page height starts a new page', () => {
  const pieces = [rectPiece('a', 30, 10), rectPiece('b', 30, 10)];
  const pages = packShelves(pieces, 50, 30, 5); // too short for a second shelf
  assert(pages.length === 2, `expected the second piece to spill onto a new page, got ${pages.length} page(s)`);
  assert(pages[0].length === 1 && pages[1].length === 1);
});

test('consecutive pieces on the same shelf are separated by exactly spacingMm', () => {
  const pieces = [rectPiece('a', 40, 40), rectPiece('b', 30, 30)];
  const pages = packShelves(pieces, 100, 100, 5);
  const a = pages[0].find((i) => i.piece.id === 'a');
  const b = pages[0].find((i) => i.piece.id === 'b');
  assertClose(b.x - (a.x + 40), 5, 1e-9, 'gap between a and b should equal spacingMm');
});

test('packs tallest pieces first', () => {
  const pieces = [rectPiece('short', 10, 10), rectPiece('tall', 10, 90)];
  const pages = packShelves(pieces, 100, 200, 5);
  // The tall piece should be placed first (smallest x among same-shelf items,
  // i.e. leftmost) since sorting happens before packing.
  const tall = pages[0].find((i) => i.piece.id === 'tall');
  const short = pages[0].find((i) => i.piece.id === 'short');
  assert(tall.x < short.x, 'the tallest piece should be packed first (placed further left)');
});

test('an oversized single piece is still placed rather than looping forever or crashing', () => {
  const pieces = [rectPiece('huge', 200, 200), rectPiece('normal', 10, 10)];
  const pages = packShelves(pieces, 50, 50, 5);
  const allIds = pages.flat().map((i) => i.piece.id).sort();
  assert(allIds.join(',') === 'huge,normal', 'both pieces should still be placed somewhere');
});

run();
