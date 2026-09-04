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
// Only ONE hole (at most) is ever "selected" at a time — see
// EditorView.js's `selectedCutout` — and only that one shows its dashed
// move-rect + resize handle; the rest render an invisible-but-clickable hit
// rect, so a piece with many holes stays readable. A plain click on a
// not-yet-selected hole only selects it (see renderOneHole's own comment
// for why that can't also start a drag in the same gesture); dragging only
// ever acts on the already-selected one.
//
// No store/project/pieceId knowledge here — the caller supplies the raw
// hole list, which index (if any) is selected, and plain
// (index) => void / (index, patch) => void select/commit callbacks.
import { svgEl } from './dom.js';
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

function renderOneHole(group, hole, isSelected, onSelect, onCommit) {
  const rect = svgEl('rect', {
    class: isSelected ? 'hole-drag-rect selected' : 'hole-drag-rect',
    x: hole.xMm, y: hole.yMm, width: hole.widthMm, height: hole.heightMm,
  }, [svgEl('title', {}, [t(isSelected ? 'hole.dragMoveTooltip' : 'hole.selectTooltip')])]);

  // Only the selected hole gets a resize handle at all — not just hidden
  // via CSS, genuinely absent from the DOM, so an unselected hole can
  // never be resized before it's selected.
  const size = isSelected ? handleSizeFor(hole) : null;
  const handle = isSelected ? svgEl('rect', {
    class: 'hole-drag-handle',
    width: size, height: size,
  }, [svgEl('title', {}, [t('hole.dragResizeTooltip')])]) : null;
  if (handle) positionHandle(handle, hole, size);

  let dragKind = null; // 'move' | 'resize', set for the duration of one gesture
  let startPoint = null;
  const startHole = hole;

  function computeNext(clientX, clientY) {
    const p = toLocalPoint(group, clientX, clientY);
    if (!p) return null;
    return dragKind === 'move'
      ? startHole.movedBy(p.x - startPoint.x, p.y - startPoint.y)
      : startHole.resizedToward({ x: p.x, y: p.y }, MIN_HOLE_SIZE_MM);
  }

  function applyLive(next) {
    rect.setAttribute('x', next.xMm);
    rect.setAttribute('y', next.yMm);
    rect.setAttribute('width', next.widthMm);
    rect.setAttribute('height', next.heightMm);
    if (handle) positionHandle(handle, next, size);
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
    if (!el) continue;
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
  }
  rect.addEventListener('pointerdown', (evt) => {
    evt.stopPropagation();
    // Not yet selected: this click only selects it — a full render()
    // follows synchronously (see EditorView.js's selectCutout), which tears
    // down and rebuilds this whole SVG, so starting a drag in the same
    // gesture would just grab an element about to be replaced. A second,
    // separate click-drag (now that it's selected and has a real move-rect
    // style) performs the actual move — see this file's own header comment.
    if (!isSelected) { onSelect(); return; }
    beginDrag('move')(evt);
  });
  if (handle) handle.addEventListener('pointerdown', (evt) => { evt.stopPropagation(); beginDrag('resize')(evt); });

  return svgEl('g', { class: 'hole-drag-group' }, [rect, handle]);
}

/** Appends one interactive overlay per hole into `group` (the `.piece-space`
 *  element from SvgPath.pieceToStandaloneSvg). `selectedIndex` (or null) is
 *  the index of the ONE hole currently selected — only that one gets its
 *  visible drag-rect style and a resize handle; the rest render an
 *  invisible-but-clickable hit-rect (see css/style.css's `.selected`
 *  modifier) so they stay selectable without cluttering the preview.
 *  `onSelect(index)` is called on a plain click on a not-yet-selected hole.
 *  `onHoleChange(index, patch)` is called exactly once per completed drag
 *  gesture (on pointerup) on the ALREADY-selected hole, never during the
 *  drag itself. */
export function attachHoleDragOverlay(group, holes, selectedIndex, onSelect, onHoleChange) {
  holes.forEach((hole, index) => {
    group.appendChild(renderOneHole(group, hole, index === selectedIndex, () => onSelect(index), (patch) => onHoleChange(index, patch)));
  });
}
