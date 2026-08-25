// Multi-page SVG export (M7) — split into a toolbar-mounted button
// (renderExportButton, next to "Mes projets") and an editor-main hint strip
// (renderExportHint, page-count summary + Deepnest tip), so the export
// trigger no longer lives in a "zone" you have to scroll down to find. The
// "Étiqueter les pièces" toggle itself now lives in SettingsPanel.js's
// Options section — EditorView still owns the showLabels state, just
// threads it to more places than before.
import { el } from './dom.js';
import { planExport, exportProjectSvg } from '../export/ExportPipeline.js';

/**
 * @param {object} project
 * @param {boolean} showLabels current state of the "label pieces" toggle
 *   (SettingsPanel.js) — owned by EditorView, same idiom as `selected`, so
 *   the exact same value drives both the live preview strip and this
 *   export, keeping the preview an honest representation of what gets
 *   downloaded.
 */
export function renderExportButton(project, showLabels) {
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
  return button;
}

/** Lightweight, button-free hint block: page-count-per-thickness summary
 *  and the Deepnest external-link tip. */
export function renderExportHint(project) {
  const plan = planExport(project);
  const summary = plan.length
    ? plan.map((g) => `${g.thicknessMm}mm : ${g.pages.length} page${g.pages.length > 1 ? 's' : ''}`).join(' · ')
    : 'aucune pièce à exporter';

  const deepnestHint = el('span', { class: 'hint' }, [
    'Pour un nesting optimal (imbrication réelle des pièces), importer le SVG exporté dans ',
    el('a', { href: 'https://deepnest.io/', target: '_blank', rel: 'noopener', text: 'Deepnest' }),
    ' (gratuit).',
  ]);

  return el('div', { class: 'export-hint' }, [
    el('span', { class: 'hint', text: `Export SVG multi-pages — empaquetage rectangulaire optimisé, pas d’imbrication réelle des pièces. ${summary}.` }),
    deepnestHint,
  ]);
}
