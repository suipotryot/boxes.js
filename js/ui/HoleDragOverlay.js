// Mouse drag-to-move / drag-to-resize for the holes shown in the inspector's
// piece visual (SegmentInspector.js), so a user can position a hole
// approximately with the mouse and refine it precisely afterward with
// HoleEditor.js's text field — the mouse is never the only way to reach an
// exact value, so this never needs to be pixel-perfect.
//
// Attaches directly into the SAME rotated `.piece-space` group SvgPath.js's
// pieceToStandaloneSvg wraps the piece's own outline/holes in (the 180°
// rotation that puts finger joints at the bottom on screen). Because these
// overlay rects are plain children of that group, they can use a hole's raw
// xMm/yMm/widthMm/heightMm directly as their own x/y/width/height — the
// group's transform displays them rotated correctly for free, and
// group.getScreenCTM() (called at drag time, on that same group) gives the
// exact matrix from a pointer event's clientX/clientY back into that same
// local mm space, already accounting for the rotation and for the CSS
// max-width:100% scaling applied to the SVG.
//
// No store/project/pieceId knowledge here — the caller supplies the raw
// hole list and a plain (index, patch) => void commit callback.
import { svgEl } from './dom.js';
import { moveHoleBy, resizeHoleToward } from '../geometry/Hole.js';
import { t } from '../i18n/index.js';

const MIN_HOLE_SIZE_MM = 1;
// A handle sized as a fraction of the hole's own smaller dimension, clamped
// so a tiny hole still gets a grabbable handle and a huge one doesn't get a
// handle bigger than the hole itself.
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

function handleSizeFor(hole) {
  return Math.min(HANDLE_MAX_MM, Math.max(HANDLE_MIN_MM, Math.min(hole.widthMm, hole.heightMm) * HANDLE_FRACTION));
}

function positionHandle(handle, hole, size) {
  handle.setAttribute('x', hole.xMm + hole.widthMm - size / 2);
  handle.setAttribute('y', hole.yMm + hole.heightMm - size / 2);
}

function renderOneHole(group, hole, onCommit) {
  const rect = svgEl('rect', {
    class: 'hole-drag-rect',
    x: hole.xMm, y: hole.yMm, width: hole.widthMm, height: hole.heightMm,
  }, [svgEl('title', {}, [t('hole.dragMoveTooltip')])]);

  const size = handleSizeFor(hole);
  const handle = svgEl('rect', {
    class: 'hole-drag-handle',
    width: size, height: size,
  }, [svgEl('title', {}, [t('hole.dragResizeTooltip')])]);
  positionHandle(handle, hole, size);

  let dragKind = null; // 'move' | 'resize', set for the duration of one gesture
  let startPoint = null;
  const startHole = hole;

  function computeNext(clientX, clientY) {
    const p = toLocalPoint(group, clientX, clientY);
    if (!p) return null;
    return dragKind === 'move'
      ? moveHoleBy(startHole, p.x - startPoint.x, p.y - startPoint.y)
      : resizeHoleToward(startHole, { x: p.x, y: p.y }, MIN_HOLE_SIZE_MM);
  }

  function applyLive(next) {
    rect.setAttribute('x', next.xMm);
    rect.setAttribute('y', next.yMm);
    rect.setAttribute('width', next.widthMm);
    rect.setAttribute('height', next.heightMm);
    positionHandle(handle, next, size);
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
    const next = computeNext(evt.clientX, evt.clientY) || startHole;
    dragKind = null;
    onCommit({
      xMm: roundMm(next.xMm), yMm: roundMm(next.yMm),
      widthMm: roundMm(next.widthMm), heightMm: roundMm(next.heightMm),
    });
  }

  for (const el of [rect, handle]) {
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
  }
  rect.addEventListener('pointerdown', beginDrag('move'));
  handle.addEventListener('pointerdown', beginDrag('resize'));

  return svgEl('g', { class: 'hole-drag-group' }, [rect, handle]);
}

/** Appends one interactive overlay per hole into `group` (the `.piece-space`
 *  element from SvgPath.pieceToStandaloneSvg). `onHoleChange(index, patch)`
 *  is called exactly once per completed drag gesture (on pointerup), never
 *  during the drag itself. */
export function attachHoleDragOverlay(group, holes, onHoleChange) {
  holes.forEach((hole, index) => {
    group.appendChild(renderOneHole(group, hole, (patch) => onHoleChange(index, patch)));
  });
}
