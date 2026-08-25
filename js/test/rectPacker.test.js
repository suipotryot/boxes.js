import { test, assert, assertClose, run } from './testHarness.js';
import { packPieces } from '../export/RectPacker.js';

// A simple axis-aligned rectangle outline, (0,0) to (w,h) — pieceBounds()
// reads straight off piece.outline, so this is all packPieces needs.
function rectPiece(id, w, h) {
  return {
    id,
    outline: [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }],
    holes: [],
  };
}

test('small pieces that all fit within one page end up on a single page', () => {
  const pieces = [rectPiece('a', 40, 40), rectPiece('b', 30, 30), rectPiece('c', 20, 20)];
  const pages = packPieces(pieces, 100, 100, 5);
  assert(pages.length === 1, `expected 1 page, got ${pages.length}`);
  assert(pages[0].length === 3, `expected all 3 pieces on that page, got ${pages[0].length}`);
});

test('every input piece appears exactly once across all pages', () => {
  const pieces = [rectPiece('a', 40, 40), rectPiece('b', 30, 30), rectPiece('c', 20, 20), rectPiece('d', 25, 60)];
  const pages = packPieces(pieces, 60, 60, 5);
  const allIds = pages.flat().map((item) => item.piece.id).sort();
  assert(allIds.join(',') === 'a,b,c,d', `expected every piece placed exactly once, got ${allIds.join(',')}`);
});

test('a piece whose bounding box, plus margin, exactly fills a fresh page is still placed (not silently dropped)', () => {
  // Regression guard: an earlier implementation used maxrects-packer's own
  // `border` option for the page-edge margin, which silently drops a rect
  // that fits the nominal page but not the border-shrunk packable area
  // (the library's own oversize pre-check doesn't account for `border`).
  // A 25x50 piece on a 60-wide/60-tall page with spacingMm=5 exercises
  // exactly that edge: 50 == 60 - 2*5, i.e. it exactly saturates the
  // packable height once the margin is accounted for.
  const pieces = [rectPiece('a', 40, 40), rectPiece('b', 30, 30), rectPiece('c', 20, 20), rectPiece('d', 25, 50)];
  const pages = packPieces(pieces, 60, 60, 5);
  const allIds = pages.flat().map((item) => item.piece.id).sort();
  assert(allIds.join(',') === 'a,b,c,d', `expected every piece placed exactly once, got ${allIds.join(',')}`);
});

test('a piece that no longer fits the page starts a new page', () => {
  const pieces = [rectPiece('a', 30, 10), rectPiece('b', 30, 10)];
  const pages = packPieces(pieces, 50, 30, 5); // too short for both on one page
  assert(pages.length === 2, `expected the second piece to spill onto a new page, got ${pages.length} page(s)`);
  assert(pages[0].length === 1 && pages[1].length === 1);
});

test('two pieces on the same page are separated by at least spacingMm and never overlap', () => {
  const pieces = [rectPiece('a', 40, 40), rectPiece('b', 30, 30)];
  const pages = packPieces(pieces, 100, 100, 5);
  const a = pages[0].find((i) => i.piece.id === 'a');
  const b = pages[0].find((i) => i.piece.id === 'b');
  const overlapsX = a.x < b.x + 30 + 5 && b.x < a.x + 40 + 5;
  const overlapsY = a.y < b.y + 30 + 5 && b.y < a.y + 40 + 5;
  assert(!(overlapsX && overlapsY), `pieces a and b should not overlap (with spacingMm clearance): a=${JSON.stringify(a)} b=${JSON.stringify(b)}`);
});

test('every placed piece stays within the page margin on all sides', () => {
  const pieces = [rectPiece('a', 40, 40), rectPiece('b', 30, 30), rectPiece('c', 20, 20)];
  const pages = packPieces(pieces, 100, 100, 5);
  for (const { piece, x, y } of pages.flat()) {
    assert(x >= 5 - 1e-9, `piece ${piece.id} x=${x} should be at least spacingMm from the left edge`);
    assert(y >= 5 - 1e-9, `piece ${piece.id} y=${y} should be at least spacingMm from the top edge`);
  }
});

test('an oversized single piece is still placed rather than looping forever or crashing', () => {
  const pieces = [rectPiece('huge', 200, 200), rectPiece('normal', 10, 10)];
  const pages = packPieces(pieces, 50, 50, 5);
  const allIds = pages.flat().map((i) => i.piece.id).sort();
  assert(allIds.join(',') === 'huge,normal', 'both pieces should still be placed somewhere');
});

test('packs more pieces onto one page than the old shelf packer could, for a set that used to waste a whole row', () => {
  // Reproduces the user-reported complaint: one tall piece plus several
  // short pieces of varying widths. A shelf packer puts the tall piece on
  // its own row (wasting the space below every short piece that follows
  // it on the SAME row up to the tall row's height), or wastes space to
  // its right if nothing else fits that row's width. MaxRects can instead
  // backfill that leftover rectangle with a later piece.
  const pieces = [
    rectPiece('tall', 20, 90),
    rectPiece('short1', 70, 20),
    rectPiece('short2', 70, 20),
    rectPiece('short3', 70, 20),
  ];
  // Page exactly wide enough for tall+short side by side (20+70+3*5=105),
  // and just tall enough for the tall piece plus margin (90+2*5=100) —
  // a shelf packer must spill short2/short3 onto new shelves that don't
  // fit under "tall"'s row and so overflow to a second page; MaxRects can
  // stack short1/short2/short3 in the 70-wide column next to "tall".
  const pages = packPieces(pieces, 105, 100, 5);
  assert(pages.length === 1, `expected every piece to fit on a single page, got ${pages.length} page(s)`);
});

run();
