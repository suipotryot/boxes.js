// Mouse drag-to-move / drag-to-resize for the grip notches shown in the
// inspector's piece visual (SegmentInspector.js) — the notch counterpart to
// HoleDragOverlay.js, sharing its exact pointer-event/SVG-CTM mechanics.
// The one real difference is geometric: a Notch is always soldered to its
// wall's own free/top edge (see Notch.js's header comment), and that edge's
// u axis lines up exactly with the piece's own x axis, with its own y
// tracking the wall's local height (heightAt(spans, u)) — so in the piece's
// local mm space a notch occupies x=offsetMm, y=localHeightMm-depthMm,
// width=widthMm, height=depthMm, ANCHORED at (offsetMm, localHeightMm) —
// the top-left corner, not the bottom-left corner a Hole anchors at. That
// flips which corner moves during a move-drag (none — only offsetMm is
// free, never the edge line) and which corner the resize handle sits on
// (top-right here, vs bottom-right for a hole).
//
// Attaches into the SAME rotated `.piece-space` group as
// HoleDragOverlay.attachHoleDragOverlay — see that file's own header
// comment for why raw mm values can be used directly as SVG rect
// coordinates with no separate transform.
//
// No store/project/pieceId knowledge here — the caller supplies the raw
// notch list, the wall's own heightProfile() spans (for heightAt), and a
// plain (index, patch) => void commit callback.
import { svgEl } from './dom.js';
import { heightAt } from '../model/GridQuery.js';
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

function floorMm(notch, localHeightMm) {
  return localHeightMm - notch.depthMm;
}

function handleSizeFor(notch) {
  return Math.min(HANDLE_MAX_MM, Math.max(HANDLE_MIN_MM, Math.min(notch.widthMm, notch.depthMm) * HANDLE_FRACTION));
}

// Top-right corner of the notch's rect — diagonally opposite its anchor
// (offsetMm, localHeightMm), which is the rect's own bottom-left corner
// once the floor (a derived value, not a stored field) becomes the rect's
// y attribute.
function positionHandle(handle, notch, localHeightMm, size) {
  handle.setAttribute('x', notch.offsetMm + notch.widthMm - size / 2);
  handle.setAttribute('y', floorMm(notch, localHeightMm) - size / 2);
}

function renderOneNotch(group, notch, localHeightMm, onCommit) {
  const rect = svgEl('rect', {
    class: 'notch-drag-rect',
    x: notch.offsetMm, y: floorMm(notch, localHeightMm), width: notch.widthMm, height: notch.depthMm,
  }, [svgEl('title', {}, [t('notch.dragMoveTooltip')])]);

  const size = handleSizeFor(notch);
  const handle = svgEl('rect', {
    class: 'notch-drag-handle',
    width: size, height: size,
  }, [svgEl('title', {}, [t('notch.dragResizeTooltip')])]);
  positionHandle(handle, notch, localHeightMm, size);

  let dragKind = null; // 'move' | 'resize', set for the duration of one gesture
  let startPoint = null;
  const startNotch = notch;

  function computeNext(clientX, clientY) {
    const p = toLocalPoint(group, clientX, clientY);
    if (!p) return null;
    return dragKind === 'move'
      ? startNotch.movedBy(p.x - startPoint.x)
      : startNotch.resizedToward({ x: p.x, y: p.y }, MIN_NOTCH_SIZE_MM, localHeightMm);
  }

  function applyLive(next) {
    rect.setAttribute('x', next.offsetMm);
    rect.setAttribute('y', floorMm(next, localHeightMm));
    rect.setAttribute('width', next.widthMm);
    rect.setAttribute('height', next.depthMm);
    positionHandle(handle, next, localHeightMm, size);
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
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
  }
  rect.addEventListener('pointerdown', beginDrag('move'));
  handle.addEventListener('pointerdown', beginDrag('resize'));

  return svgEl('g', { class: 'notch-drag-group' }, [rect, handle]);
}

/** Appends one interactive overlay per notch into `group` (the
 *  `.piece-space` element from SvgPath.pieceToStandaloneSvg). `spans` is
 *  the wall's own heightProfile(run, grid, project) — each notch's local
 *  height is read at its own center (offsetMm + widthMm/2), exactly like
 *  Assembly.buildWallPiece's gripFragments, and held fixed for the whole
 *  gesture. `onNotchChange(index, patch)` is called exactly once per
 *  completed drag gesture (on pointerup), never during the drag itself. */
export function attachNotchDragOverlay(group, notches, spans, onNotchChange) {
  notches.forEach((notch, index) => {
    const localHeightMm = heightAt(spans, notch.offsetMm + notch.widthMm / 2);
    group.appendChild(renderOneNotch(group, notch, localHeightMm, (patch) => onNotchChange(index, patch)));
  });
}
