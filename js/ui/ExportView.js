// Multi-page SVG export trigger (M7). A plain summary + button, not
// wired into the store — export never mutates the project, it only reads
// it, so there's nothing here for EditorView's render loop to react to.
import { el } from './dom.js';
import { planExport, exportProjectSvg } from '../export/ExportPipeline.js';

export function renderExportPanel(project) {
  const plan = planExport(project);
  const summary = plan.length
    ? plan.map((g) => `${g.thicknessMm}mm : ${g.pages.length} page${g.pages.length > 1 ? 's' : ''}`).join(' · ')
    : 'aucune pièce à exporter';

  const button = el('button', {
    class: 'btn',
    text: 'Exporter (SVG)',
    onClick: async () => {
      button.disabled = true;
      button.textContent = 'Export en cours…';
      try {
        await exportProjectSvg(project);
      } finally {
        button.disabled = false;
        button.textContent = 'Exporter (SVG)';
      }
    },
  });

  return el('div', { class: 'export-panel' }, [
    el('span', { class: 'hint', text: `Export SVG multi-pages — empaquetage par boîte englobante, pas d’imbrication réelle des pièces. ${summary}.` }),
    button,
  ]);
}
