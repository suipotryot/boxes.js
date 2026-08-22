// Orchestrates the M3 editor: settings panel, the clickable grid, the
// segment inspector, and a live low-res preview strip driven by the same
// computePieces() pipeline that will eventually feed SVG export — proving,
// while you edit, that it's one pipeline, not two.
import { el, clear } from './dom.js';
import { renderEditorSvg } from './EditorRenderer.js';
import { renderInspector } from './SegmentInspector.js';
import { renderSettingsPanel } from './SettingsPanel.js';
import { renderExportPanel } from './ExportView.js';
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

function renderPreviewStrip(project, selected, showLabels) {
  const pieces = computePieces(project);
  const highlightId = selectedPieceId(project, selected);
  const cards = pieces.map((piece) => {
    const svg = pieceToStandaloneSvg(piece, { padding: 4, minSize: 40, showLabels });
    const highlighted = piece.id === highlightId;
    return el('div', { class: highlighted ? 'preview-card highlighted' : 'preview-card' }, [svg, el('div', { class: 'preview-label', text: piece.id })]);
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
  let showLabels = true;
  // Épaisseurs & hauteurs starts open (the fields a new box always needs);
  // the other three are lower-frequency settings, closed by default.
  let openSections = { thickness: true, fingerJoint: false, lid: false, laserBed: false };

  function select(next) {
    selected = next;
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

    const toolbar = el('div', { class: 'toolbar' }, [
      onBackToList ? el('button', { class: 'btn', text: 'Mes projets', onClick: onBackToList }) : null,
      el('div', { class: 'toolbar-group' }, [
        el('button', { class: 'btn', text: 'Annuler (Ctrl+Z)', disabled: !store.canUndo(), onClick: () => store.undo() }),
        el('button', { class: 'btn', text: 'Rétablir (Ctrl+Shift+Z)', disabled: !store.canRedo(), onClick: () => store.redo() }),
      ]),
    ]);

    const editorCanvas = el('div', { class: 'editor-canvas' }, [renderEditorSvg(project, selected, select)]);

    container.appendChild(el('div', { class: 'editor-layout' }, [
      el('aside', { class: 'panel settings-col' }, [renderSettingsPanel(project, store, openSections, toggleSection)]),
      el('div', { class: 'editor-main' }, [toolbar, editorCanvas, renderPreviewStrip(project, selected, showLabels), renderExportPanel(project, showLabels, toggleLabels)]),
      el('aside', { class: 'panel inspector-col' }, [renderInspector(project, selected, store)]),
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
