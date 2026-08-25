// Bounding-box bin packing via maxrects-packer (MaxRects algorithm) —
// still NOT real polygon nesting (pieces keep their full rectangular
// footprint, including any empty margin around an irregular outline),
// but far denser than the naive shelf packer it replaces: instead of
// wasting the tail of every row to the tallest piece in it, MaxRects can
// fill leftover space with pieces from anywhere else in the set.
//
// `spacingMm` doubles as both the gap between pieces and the margin from
// the page edges — one knob, matching this app's general preference for
// not adding a field the plan didn't ask for (padding covers the gap
// between rects; `border` is set to the same value for the edge margin).
import { MaxRectsPacker } from 'maxrects-packer';
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
export function packPieces(pieces, pageWidthMm, pageHeightMm, spacingMm) {
  // The page's own `border` option looks like the obvious way to get a
  // page-edge margin, but it's buggy for our purposes: maxrects-packer's
  // "is this oversized" pre-check compares against the page's nominal
  // width/height, not the border-shrunk packable area, so a piece that's
  // within the nominal page but no longer fits once the border eats into
  // it gets silently dropped — added to nothing, present nowhere in
  // packer.bins. Shrinking the page ourselves and offsetting the result
  // sidesteps that: the oversize check then correctly compares against
  // the actual packable area, and nothing goes missing.
  const packableWidthMm = pageWidthMm - 2 * spacingMm;
  const packableHeightMm = pageHeightMm - 2 * spacingMm;
  const packer = new MaxRectsPacker(packableWidthMm, packableHeightMm, spacingMm, {
    smart: false, // page is a fixed-size laser bed, not an auto-shrunk bin
    pot: false, // real mm dimensions, no power-of-2 constraint
    allowRotation: false, // out of scope: rotating would also need to rotate the rendered piece and its label
  });

  const items = pieces.map((piece) => {
    const bounds = pieceBounds(piece);
    return { width: bounds.width, height: bounds.height, piece };
  });
  packer.addArray(items);

  // An item too big for the packable area lands alone in its own oversized
  // bin with x/y left undefined — still placed (never silently dropped
  // from export) at the page's own margin, same fallback position a lone
  // piece would get from the old shelf packer.
  return packer.bins.map((bin) =>
    bin.rects.map((r) => ({
      piece: r.piece,
      x: r.oversized ? spacingMm : r.x + spacingMm,
      y: r.oversized ? spacingMm : r.y + spacingMm,
    }))
  );
}
