// Mouse drag-to-move / drag-to-resize for the grip notches shown in the
// inspector's piece visual (SegmentInspector.js) — the notch counterpart to
// HoleDragOverlay.js, sharing its exact pointer-event/SVG-CTM mechanics.
// The one real difference is geometric: unlike a Hole, a Notch is always
// soldered to one particular edge of the piece, and which real (x,y) axes
// its own offsetMm/depthMm land on depends on WHICH edge — a wall's own
// free/top edge, one of its own END edges, or one of a flat panel's own
// open compass sides all disagree on that. NotchFrame.js carries that
// mapping (`frame`, resolved by the caller — see SegmentInspector.js) so
// this file stays geometry-agnostic, only converting between real mm points
// (from the pointer, via the piece's own CTM) and the canonical space
// Notch.movedBy/resizedToward already operate in.
//
// Attaches into the SAME rotated `.piece-space` group as
// HoleDragOverlay.attachHoleDragOverlay — see that file's own header
// comment for why raw mm values can be used directly as SVG rect
// coordinates with no separate transform.
//
// Only ONE notch (at most) is ever "selected" at a time — see
// EditorView.js's `selectedCutout` — and only that one shows its dashed
// move-rect + resize handle; the rest render an invisible-but-clickable hit
// rect, so a piece with many notches stays readable. See
// HoleDragOverlay.js's own header comment for why a plain click on a
// not-yet-selected notch only selects it, never also starts a drag.
//
// No store/project/pieceId knowledge here — the caller supplies the raw
// notch list, the edge's own `frame` (NotchFrame.js), which index (if any)
// is selected, and plain (index) => void / (index, patch) => void
// select/commit callbacks.
import { svgEl } from './dom.js';
import { frameCorners, frameToCanonical } from '../geometry/oo/NotchFrame.js';
import { t } from '../i18n/index.js';

const MIN_NOTCH_SIZE_MM = 1;
// A handle sized as a fraction of the notch's own smaller dimension,
// clamped so a tiny notch still gets a grabbable handle and a huge one
// doesn't get a handle bigger than the notch itself.
const HANDLE_MIN_MM = 2;
const HANDLE_MAX_MM = 6;
const HANDLE_FRACTION = 0.4;

function toLocalPoint(group, clientX, clientY) {
  const ctm = group.getScreenCTM();
  if (!ctm) return null;
  return new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
}

// Whole-mm values, matching what a user would type into the text field —
// the mouse is for rough placement, not fractional-mm precision.
function roundMm(n) {
  return Math.round(n);
}

function handleSizeFor(notch) {
  return Math.min(HANDLE_MAX_MM, Math.max(HANDLE_MIN_MM, Math.min(notch.widthMm, notch.depthMm) * HANDLE_FRACTION));
}

// The notch's own rect, normalized from its two frame-mapped corners (the
// anchor is only ever top-left in the wall-top case NotchDragOverlay used
// to be hardcoded for — every other orientation puts it at a different
// corner, so min/max is the only frame-agnostic way to get a valid rect).
function rectFor(frame, boundaryMm, notch) {
  const { anchor, free } = frameCorners(frame, boundaryMm, notch);
  return {
    x: Math.min(anchor.x, free.x), y: Math.min(anchor.y, free.y),
    width: Math.abs(free.x - anchor.x), height: Math.abs(free.y - anchor.y),
    handleX: free.x, handleY: free.y,
  };
}

function positionHandle(handle, rect, size) {
  handle.setAttribute('x', rect.handleX - size / 2);
  handle.setAttribute('y', rect.handleY - size / 2);
}

function renderOneNotch(group, notch, frame, boundaryMm, isSelected, onSelect, onCommit) {
  const rectGeom = rectFor(frame, boundaryMm, notch);
  const rect = svgEl('rect', {
    class: isSelected ? 'notch-drag-rect selected' : 'notch-drag-rect',
    x: rectGeom.x, y: rectGeom.y, width: rectGeom.width, height: rectGeom.height,
  }, [svgEl('title', {}, [t(isSelected ? 'notch.dragMoveTooltip' : 'notch.selectTooltip')])]);

  // Only the selected notch gets a resize handle at all — not just hidden
  // via CSS, genuinely absent from the DOM (see HoleDragOverlay.js's mirror
  // of this).
  const size = isSelected ? handleSizeFor(notch) : null;
  const handle = isSelected ? svgEl('rect', {
    class: 'notch-drag-handle',
    width: size, height: size,
  }, [svgEl('title', {}, [t('notch.dragResizeTooltip')])]) : null;
  if (handle) positionHandle(handle, rectGeom, size);

  let dragKind = null; // 'move' | 'resize', set for the duration of one gesture
  let startPoint = null;
  const startNotch = notch;

  function computeNext(clientX, clientY) {
    const p = toLocalPoint(group, clientX, clientY);
    if (!p) return null;
    const canon = frameToCanonical(frame, boundaryMm, p.x, p.y);
    if (dragKind === 'move') {
      const startCanon = frameToCanonical(frame, boundaryMm, startPoint.x, startPoint.y);
      return startNotch.movedBy(canon.x - startCanon.x);
    }
    return startNotch.resizedToward({ x: canon.x, y: canon.y }, MIN_NOTCH_SIZE_MM, canon.localHeightMm);
  }

  function applyLive(next) {
    const nextRect = rectFor(frame, boundaryMm, next);
    rect.setAttribute('x', nextRect.x);
    rect.setAttribute('y', nextRect.y);
    rect.setAttribute('width', nextRect.width);
    rect.setAttribute('height', nextRect.height);
    if (handle) positionHandle(handle, nextRect, size);
  }

  function beginDrag(kind) {
    return (evt) => {
      const p = toLocalPoint(group, evt.clientX, evt.clientY);
      if (!p) return;
      dragKind = kind;
      startPoint = p;
      evt.currentTarget.setPointerCapture(evt.pointerId);
    };
  }

  function onMove(evt) {
    if (!dragKind) return;
    const next = computeNext(evt.clientX, evt.clientY);
    if (next) applyLive(next);
  }

  function onUp(evt) {
    if (!dragKind) return;
    const next = computeNext(evt.clientX, evt.clientY) || startNotch;
    dragKind = null;
    onCommit({
      offsetMm: roundMm(next.offsetMm),
      widthMm: roundMm(next.widthMm),
      depthMm: roundMm(next.depthMm),
    });
  }

  for (const el of [rect, handle]) {
    if (!el) continue;
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
  }
  rect.addEventListener('pointerdown', (evt) => {
    evt.stopPropagation();
    // Not yet selected: this click only selects it — see
    // HoleDragOverlay.js's mirror-image comment for why a drag can't also
    // start in this same gesture.
    if (!isSelected) { onSelect(); return; }
    beginDrag('move')(evt);
  });
  if (handle) handle.addEventListener('pointerdown', (evt) => { evt.stopPropagation(); beginDrag('resize')(evt); });

  return svgEl('g', { class: 'notch-drag-group' }, [rect, handle]);
}

/** Appends one interactive overlay per notch into `group` (the
 *  `.piece-space` element from SvgPath.pieceToStandaloneSvg). `frame`
 *  (NotchFrame.js) is the edge's own orientation, shared by every notch on
 *  it — its own `boundaryAt(u)` is read at each notch's own center
 *  (offsetMm + widthMm/2), exactly like Assembly.buildWallPiece's
 *  gripFragments, and held fixed for that notch's whole render/gesture.
 *  `selectedIndex` (or null) is the index of the ONE notch currently
 *  selected — only that one gets its visible drag-rect style and a resize
 *  handle (see HoleDragOverlay.attachHoleDragOverlay's mirror comment).
 *  `onSelect(index)` is called on a plain click on a not-yet-selected
 *  notch. `onNotchChange(index, patch)` is called exactly once per
 *  completed drag gesture (on pointerup) on the ALREADY-selected notch,
 *  never during the drag itself. */
export function attachNotchDragOverlay(group, notches, frame, selectedIndex, onSelect, onNotchChange) {
  notches.forEach((notch, index) => {
    const boundaryMm = frame.zeroBoundary ? 0 : frame.boundaryAt(notch.offsetMm + notch.widthMm / 2);
    group.appendChild(renderOneNotch(group, notch, frame, boundaryMm, index === selectedIndex, () => onSelect(index), (patch) => onNotchChange(index, patch)));
  });
}
