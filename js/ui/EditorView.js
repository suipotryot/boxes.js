// Orchestrates the M3 editor: settings panel, the clickable grid, the
// segment inspector, and a live low-res preview strip driven by the same
// computePieces() pipeline that will eventually feed SVG export — proving,
// while you edit, that it's one pipeline, not two.
import { el, clear } from './dom.js';
import { renderEditorSvg } from './EditorRenderer.js';
import { renderInspector } from './SegmentInspector.js';
import { renderSettingsPanel } from './SettingsPanel.js';
import { computePieces } from '../geometry/PieceFactory.js';
import { pieceToStandaloneSvg } from '../geometry/SvgPath.js';

function renderPreviewStrip(project) {
  const pieces = computePieces(project);
  const cards = pieces.map((piece) => {
    const svg = pieceToStandaloneSvg(piece, { padding: 4, minSize: 40 });
    return el('div', { class: 'preview-card' }, [svg, el('div', { class: 'preview-label', text: piece.id })]);
  });
  return el('div', { class: 'preview-strip' }, cards);
}

export function mountEditorView(container, store) {
  let selected = null;

  function select(next) {
    selected = next;
    render();
  }

  function render() {
    clear(container);
    const project = store.project;

    const toolbar = el('div', { class: 'toolbar' }, [
      el('button', { class: 'btn', text: 'Annuler (Ctrl+Z)', disabled: !store.canUndo(), onClick: () => store.undo() }),
      el('button', { class: 'btn', text: 'Rétablir (Ctrl+Shift+Z)', disabled: !store.canRedo(), onClick: () => store.redo() }),
    ]);

    const editorCanvas = el('div', { class: 'editor-canvas' }, [renderEditorSvg(project, selected, select)]);

    container.appendChild(el('div', { class: 'editor-layout' }, [
      el('aside', { class: 'panel settings-col' }, [renderSettingsPanel(project, store)]),
      el('div', { class: 'editor-main' }, [toolbar, editorCanvas, renderPreviewStrip(project)]),
      el('aside', { class: 'panel inspector-col' }, [renderInspector(project, selected, store)]),
    ]));
  }

  document.addEventListener('keydown', (evt) => {
    const isUndo = (evt.ctrlKey || evt.metaKey) && !evt.shiftKey && evt.key.toLowerCase() === 'z';
    const isRedo = (evt.ctrlKey || evt.metaKey) && evt.shiftKey && evt.key.toLowerCase() === 'z';
    if (isUndo) {
      evt.preventDefault();
      store.undo();
    } else if (isRedo) {
      evt.preventDefault();
      store.redo();
    }
  });

  store.subscribe(render);
  render();
}
