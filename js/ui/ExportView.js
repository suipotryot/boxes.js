// Multi-page SVG export trigger (M7). A plain summary + button, not
// wired into the store — export never mutates the project, it only reads
// it, so there's nothing here for EditorView's render loop to react to.
import { el } from './dom.js';
import { planExport, exportProjectSvg } from '../export/ExportPipeline.js';

/**
 * @param {object} project
 * @param {boolean} showLabels current state of the "label pieces" toggle —
 *   owned by EditorView (same idiom as its `selected` state) so the exact
 *   same value drives both the live preview strip and this export, keeping
 *   the preview an honest representation of what gets downloaded.
 * @param {(next:boolean) => void} onToggleLabels
 */
export function renderExportPanel(project, showLabels, onToggleLabels) {
  const plan = planExport(project);
  const summary = plan.length
    ? plan.map((g) => `${g.thicknessMm}mm : ${g.pages.length} page${g.pages.length > 1 ? 's' : ''}`).join(' · ')
    : 'aucune pièce à exporter';

  const labelsToggle = el('label', { class: 'field export-labels-toggle' }, [
    el('input', {
      type: 'checkbox', checked: showLabels,
      onChange: (evt) => onToggleLabels(evt.target.checked),
    }),
    el('span', { text: ' Étiqueter les pièces' }),
  ]);

  const button = el('button', {
    class: 'btn',
    text: 'Exporter (SVG)',
    onClick: async () => {
      button.disabled = true;
      button.textContent = 'Export en cours…';
      try {
        await exportProjectSvg(project, { labels: showLabels });
      } finally {
        button.disabled = false;
        button.textContent = 'Exporter (SVG)';
      }
    },
  });

  return el('div', { class: 'export-panel' }, [
    el('span', { class: 'hint', text: `Export SVG multi-pages — empaquetage par boîte englobante, pas d’imbrication réelle des pièces. ${summary}.` }),
    labelsToggle,
    button,
  ]);
}
