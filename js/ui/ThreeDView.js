// Mounts a Zdog canvas showing the assembled box, following the same
// mount*View(container, opts) -> {unmount()} contract used everywhere else
// (AppShell.js's mountScreen/mountEditorScreen) — plus updateProject(),
// so the caller can push new project state without re-mounting (which
// would reset the user's current drag-rotation/zoom, see EditorView.js).
import Zdog from 'zdog';
import { el, clear } from './dom.js';
import { t } from '../i18n/index.js';
import { outerBoxWidth, outerBoxDepth, outerBoxHeight } from '../model/GridQuery.js';
import { populateScene } from './Zdog3DScene.js';

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 20;
const ZOOM_WHEEL_SENSITIVITY = 0.002;
const FIT_MARGIN = 0.7; // leave ~30% of the canvas as breathing room around the box

// Centers the box's own middle point at the world origin and picks a zoom
// so its largest dimension roughly fills the canvas — Zdog's `zoom` is a
// literal px-per-mm multiplier (Illustration's own scale = pixelRatio *
// zoom), so a fixed default would look tiny for a small box and overflow
// the canvas for a large one, exactly what produced an unreadable
// off-center crop before this existed. Only called once, right after the
// first real measurement of the canvas — NOT on every updateProject — so
// a later edit never undoes the zoom/rotation the user set by hand.
function fitView(illustration, project) {
  const maxDimension = Math.max(
    outerBoxWidth(project.grid, project),
    outerBoxDepth(project.grid, project),
    outerBoxHeight(project.grid, project),
  ) || 1;
  const displaySize = Math.min(illustration.width, illustration.height) || 1;
  illustration.zoom = (displaySize / maxDimension) * FIT_MARGIN;
  illustration.translate.set({
    x: -outerBoxWidth(project.grid, project) / 2,
    y: -outerBoxDepth(project.grid, project) / 2,
    z: -outerBoxHeight(project.grid, project) / 2,
  });
}

/**
 * @param {HTMLElement} container appended into immediately; owned by the
 *   caller for the whole lifetime of the returned handle.
 * @param {object} project
 * @returns {{ unmount(): void, updateProject(project): void }}
 */
export function mountThreeDView(container, project) {
  const canvas = el('canvas', { class: 'threed-canvas' });
  const hint = el('div', { class: 'hint threed-hint', text: t('editor.view3dHint') });
  container.appendChild(canvas);
  container.appendChild(hint);

  const illustration = new Zdog.Illustration({ element: canvas, dragRotate: true, resize: true });
  populateScene(illustration, project);

  // `resize: true` above already measured the canvas once, synchronously,
  // during this very function call — but `container` (owned by the
  // caller, EditorView.js) isn't actually inserted into the live document
  // until AFTER mountThreeDView() returns, so that first measurement reads
  // a detached 0x0 box and Zdog sizes the canvas to nothing. Re-measure
  // (and only then fit the initial view) on the first animation frame
  // instead: by then the browser has committed the caller's own DOM
  // insertion, so the canvas has its real CSS size.
  let measured = false;
  let raf = requestAnimationFrame(animate);
  function animate() {
    if (!measured) {
      measured = true;
      illustration.setMeasuredSize();
      fitView(illustration, project);
    }
    illustration.updateRenderGraph();
    raf = requestAnimationFrame(animate);
  }

  function onWheel(evt) {
    evt.preventDefault();
    illustration.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, illustration.zoom - evt.deltaY * ZOOM_WHEEL_SENSITIVITY));
  }
  canvas.addEventListener('wheel', onWheel, { passive: false });

  return {
    updateProject(nextProject) {
      populateScene(illustration, nextProject);
    },
    unmount() {
      cancelAnimationFrame(raf);
      canvas.removeEventListener('wheel', onWheel);
      clear(container);
    },
  };
}
