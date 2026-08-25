// Orchestrates the M3 editor: settings panel, the clickable grid, the
// segment inspector, and a live low-res preview strip driven by the same
// computePieces() pipeline that will eventually feed SVG export — proving,
// while you edit, that it's one pipeline, not two.
import { el, clear } from './dom.js';
import { renderEditorSvg } from './EditorRenderer.js';
import { renderInspector } from './SegmentInspector.js';
import { renderSettingsPanel } from './SettingsPanel.js';
import { renderExportButton, renderExportHint, renderExportJsonButton } from './ExportView.js';
import { homeIcon } from './fields.js';
import { computePieces } from '../geometry/PieceFactory.js';
import { wallPieceId } from '../geometry/PanelBuilder.js';
import { runAt } from '../model/GridQuery.js';
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

function renderPreviewStrip(project, selectedWallId, showLabels, onSelectWall) {
  const pieces = computePieces(project);
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
        onBackToList ? el('button', { class: 'btn', onClick: onBackToList }, [homeIcon(), 'Mes projets']) : null,
        renderExportJsonButton(project),
        renderExportButton(project, showLabels),
      ]),
    ]);

    const editorCanvas = el('div', { class: 'editor-canvas' }, [renderEditorSvg(project, selected, select)]);

    container.appendChild(el('div', { class: 'editor-layout' }, [
      el('aside', { class: 'panel settings-col' }, [renderSettingsPanel(project, store, openSections, toggleSection, showLabels, toggleLabels)]),
      el('div', { class: 'editor-main' }, [toolbar, editorCanvas, renderPreviewStrip(project, selectedWallId, showLabels, selectWall), renderExportHint(project)]),
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
    },
  };
}
