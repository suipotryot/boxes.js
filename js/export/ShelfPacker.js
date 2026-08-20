// Classic shelf packing by bounding box — sort tallest-first, fill left to
// right building "shelves," wrap to a new shelf when a piece doesn't fit
// the remaining width, start a new page when a shelf doesn't fit the
// remaining height. Deliberately NOT real polygon nesting (pieces keep
// their full rectangular footprint, including any empty margin around an
// irregular outline) — a simplicity trade-off surfaced to the user in the
// export UI, not hidden.
//
// `spacingMm` doubles as both the gap between pieces and the margin from
// the page edges — one knob, matching this app's general preference for
// not adding a field the plan didn't ask for.
import { pieceBounds } from '../geometry/SvgPath.js';

/**
 * @param {object[]} pieces
 * @param {number} pageWidthMm
 * @param {number} pageHeightMm
 * @param {number} spacingMm
 * @returns {{piece:object, x:number, y:number}[][]} one array per page;
 *   (x,y) is where the piece's own bounding-box top-left corner
 *   (pieceBounds(piece).minX/minY) should land — the caller translates
 *   the piece's actual outline coordinates by (x - minX, y - minY).
 */
export function packShelves(pieces, pageWidthMm, pageHeightMm, spacingMm) {
  const items = pieces
    .map((piece) => ({ piece, bounds: pieceBounds(piece) }))
    .sort((a, b) => b.bounds.height - a.bounds.height);

  const pages = [];
  let page, cursorX, cursorY, shelfHeight;

  function startPage() {
    page = [];
    pages.push(page);
    cursorX = spacingMm;
    cursorY = spacingMm;
    shelfHeight = 0;
  }
  startPage();

  for (const { piece, bounds } of items) {
    // Only wrap/paginate when something is already placed on the current
    // shelf/page — an oversized single piece still gets placed (possibly
    // overflowing the nominal page) rather than looping forever trying to
    // find a fit that doesn't exist (no rotation or splitting here).
    if (cursorX > spacingMm && cursorX + bounds.width + spacingMm > pageWidthMm) {
      cursorX = spacingMm;
      cursorY += shelfHeight + spacingMm;
      shelfHeight = 0;
    }
    if (cursorY > spacingMm && cursorY + bounds.height + spacingMm > pageHeightMm) {
      startPage();
    }
    page.push({ piece, x: cursorX, y: cursorY });
    cursorX += bounds.width + spacingMm;
    shelfHeight = Math.max(shelfHeight, bounds.height);
  }

  return pages;
}
