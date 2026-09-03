// Orchestrates the M3 editor: settings panel, the clickable grid, the
// segment inspector, and a live low-res preview strip driven by the same
// computePieces() pipeline that will eventually feed SVG export — proving,
// while you edit, that it's one pipeline, not two.
import { el, clear } from './dom.js';
import { renderEditorSvg } from './EditorRenderer.js';
import { renderInspector } from './SegmentInspector.js';
import { renderSettingsPanel } from './SettingsPanel.js';
import { renderExportButton, renderExportDeepnestButton, renderExportJsonButton } from './ExportView.js';
import { mountThreeDView } from './ThreeDView.js';
import { homeIcon } from './fields.js';
import { t } from '../i18n/index.js';
import { Box } from '../geometry/oo/Box.js';
import { runAt, wallPieceId, outerBoxWidth, outerBoxDepth, outerBoxHeight } from '../model/GridQuery.js';
import { pieceToStandaloneSvg } from '../geometry/SvgPath.js';

// Which preview piece (if any) corresponds to the currently-selected grid
// line — a selection is one CELL, but the physical piece it belongs to
// may span several merged cells (GridQuery.enumerateWallRuns), so this
// resolves through the run rather than assuming a 1:1 id match. Null for
// an absent segment (nothing present there to highlight).
function selectedPieceId(project, selected) {
  if (!selected) return null;
  const run = runAt(project.grid, project, selected.kind, selected.c, selected.r);
  return run ? wallPieceId(run) : null;
}

/** Always-visible readout of the box's total exterior footprint — so the
 *  user knows what size box they've committed to without having to expand
 *  the (collapsible) thickness section of the settings panel to derive it
 *  themselves. */
function renderDimensionsHint(project) {
  const width = outerBoxWidth(project.grid, project).toFixed(1);
  const depth = outerBoxDepth(project.grid, project).toFixed(1);
  const height = outerBoxHeight(project.grid, project).toFixed(1);
  return el('div', { class: 'dimensions-hint' }, [
    el('span', { class: 'hint', text: t('editor.dimensions', { width, depth, height }) }),
  ]);
}

function renderPreviewStrip(project, selectedWallId, showLabels, onSelectWall) {
  const pieces = Box.fromProject(project).allPiecesBurnCorrected();
  const cards = pieces.map((piece) => {
    const svg = pieceToStandaloneSvg(piece, { padding: 4, minSize: 40, showLabels });
    const highlighted = piece.id === selectedWallId;
    return el('div', {
      class: highlighted ? 'preview-card highlighted' : 'preview-card',
      onClick: () => onSelectWall(piece.id),
    }, [svg, el('div', { class: 'preview-label', text: piece.id })]);
  });
  return el('div', { class: 'preview-strip' }, [el('div', { class: 'preview-strip-inner' }, cards)]);
}

/**
 * @param {HTMLElement} container
 * @param {object} store a ProjectStore
 * @param {{onBackToList?: () => void}} [options] `onBackToList`, if given,
 *   renders a "Mes projets" toolbar button (M6) — omitted entirely when
 *   there's nowhere to navigate back to.
 * @returns {{unmount: () => void}} tears down every side effect this
 *   function registered (the store subscription and the document-level
 *   keydown listener) — required as of M6, where AppShell mounts/unmounts
 *   the editor each time the user switches between the project list and
 *   the editor; without this, a second mount would stack a second global
 *   keydown listener that never gets cleaned up.
 */
export function mountEditorView(container, store, { onBackToList } = {}) {
  let selected = null;
  // A piece id, independent of `selected` — the only way to reach a
  // drawer sleeve's own wall (no grid cell of its own to click, see
  // DrawerBuilder.js's synthetic grid), and also what drives the grip-
  // notch editor in SegmentInspector.js. Clicking a grid segment keeps
  // populating this too (via the existing selectedPieceId bridge), so the
  // notch editor shows up for an ordinary wall click as well, not just a
  // preview-card click.
  let selectedWallId = null;
  // Off by default — labels are most useful right before a final export,
  // not while experimenting with the layout.
  let showLabels = false;
  // Épaisseurs & hauteurs starts open (the fields a new box always needs);
  // the rest are lower-frequency settings, closed by default.
  let openSections = { thickness: true, options: false, fingerJoint: false, lid: false, drawer: false, laserBed: false };

  // '2d' (the clickable grid) or '3d' (the three.js preview). `threeDContainer`
  // is created ONCE and never recreated — render() rebuilds the rest of
  // the DOM from scratch on every store change, but appendChild() MOVES an
  // existing node rather than cloning it, so re-inserting this same
  // container each render keeps the canvas, its renderer/camera/orbit
  // controls, and critically the user's current orbit/zoom alive across
  // edits instead of resetting them on every keystroke. `threeD` (the
  // mountThreeDView handle) is created lazily on first entry into 3D mode.
  let viewMode = '2d';
  const threeDContainer = el('div', { class: 'threed-view' });
  let threeD = null;

  function setViewMode(mode) {
    viewMode = mode;
    render();
  }

  function select(next) {
    selected = next;
    selectedWallId = selectedPieceId(store.project, next);
    render();
  }

  function selectWall(pieceId) {
    // Clicking a preview card supersedes the grid-segment selection —
    // showing both a segment's fields AND an unrelated piece's notch
    // editor at once would be confusing, and a base-plate/lid/drawer
    // piece has no grid segment to show fields for anyway.
    selectedWallId = pieceId;
    selected = null;
    render();
  }

  function toggleLabels(next) {
    showLabels = next;
    render();
  }

  // Deliberately does NOT call render(): the native <details> element
  // already updates its own expand/collapse visually the instant the user
  // clicks — no rebuild needed for that. This only remembers the state so
  // a LATER render(), triggered by something unrelated (e.g. editing a
  // different field), recreates each <details> already open/closed to
  // match. Calling render() here was a real, reproducible infinite loop:
  // rebuilding an ALREADY-OPEN <details> from scratch and re-attaching it
  // fires its own 'toggle' event again in Chromium (observed directly —
  // even a detached, freshly-created element with open already set fires
  // 'toggle' once it's inserted into the document), which re-ran this
  // same handler, which rendered again, forever.
  function toggleSection(key, next) {
    openSections = { ...openSections, [key]: next };
  }

  function render() {
    clear(container);
    const project = store.project;

    // Undo/redo has no toolbar buttons — Ctrl+Z / Ctrl+Shift+Z (onKeydown
    // below) are the conventional, sufficient way to reach them.
    const toolbar = el('div', { class: 'toolbar' }, [
      el('div', { class: 'toolbar-group' }, [
        onBackToList ? el('button', { class: 'btn', onClick: onBackToList }, [homeIcon(), t('editor.backToList')]) : null,
        renderExportJsonButton(project),
        renderExportButton(project, showLabels),
        renderExportDeepnestButton(project, showLabels),
      ]),
      el('div', { class: 'toolbar-group view-toggle' }, [
        el('button', { class: viewMode === '2d' ? 'btn active' : 'btn', onClick: () => setViewMode('2d'), text: t('editor.view2dTab') }),
        el('button', { class: viewMode === '3d' ? 'btn active' : 'btn', onClick: () => setViewMode('3d'), text: t('editor.view3dTab') }),
      ]),
    ]);

    // threeDContainer is the same long-lived node every render (see its
    // declaration above) — only (de)activated here, never rebuilt.
    if (viewMode === '3d') {
      if (!threeD) threeD = mountThreeDView(threeDContainer, project);
      else threeD.updateProject(project);
    } else if (threeD) {
      threeD.unmount(); // stop its rAF loop before dropping the reference
      threeD = null;
    }

    const editorCanvas = el('div', { class: 'editor-canvas' }, [
      viewMode === '3d' ? threeDContainer : renderEditorSvg(project, selected, select),
    ]);

    container.appendChild(el('div', { class: 'editor-layout' }, [
      el('aside', { class: 'panel settings-col' }, [renderSettingsPanel(project, store, openSections, toggleSection, showLabels, toggleLabels)]),
      el('div', { class: 'editor-main' }, [toolbar, renderDimensionsHint(project), editorCanvas, renderPreviewStrip(project, selectedWallId, showLabels, selectWall)]),
      el('aside', { class: 'panel inspector-col' }, [renderInspector(project, selected, selectedWallId, store)]),
    ]));
  }

  function onKeydown(evt) {
    const isUndo = (evt.ctrlKey || evt.metaKey) && !evt.shiftKey && evt.key.toLowerCase() === 'z';
    const isRedo = (evt.ctrlKey || evt.metaKey) && evt.shiftKey && evt.key.toLowerCase() === 'z';
    if (isUndo) {
      evt.preventDefault();
      store.undo();
    } else if (isRedo) {
      evt.preventDefault();
      store.redo();
    }
  }

  document.addEventListener('keydown', onKeydown);
  const unsubscribe = store.subscribe(render);
  render();

  return {
    unmount() {
      unsubscribe();
      document.removeEventListener('keydown', onKeydown);
      if (threeD) threeD.unmount();
    },
  };
}
