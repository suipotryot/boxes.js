// Multi-page SVG export (M7) — split into a toolbar-mounted button
// (renderExportButton, next to "Mes projets") and an editor-main hint strip
// (renderExportHint, page-count summary + Deepnest tip), so the export
// trigger no longer lives in a "zone" you have to scroll down to find. The
// "Étiqueter les pièces" toggle itself now lives in SettingsPanel.js's
// Options section — EditorView still owns the showLabels state, just
// threads it to more places than before. Also hosts the whole-project JSON
// export button (renderExportJsonButton) — a different export entirely
// (the full project state, not cut pieces) but the same toolbar "export"
// idiom, so it lives alongside the SVG one rather than in its own file.
import { el } from './dom.js';
import { planExport, exportProjectSvg, sanitizeFilename } from '../export/ExportPipeline.js';

// Prefers the File System Access API's save dialog (lets the user pick
// where the file goes) over the classic blob + <a download> trick (which
// always lands silently in the browser's default downloads folder) —
// falls back to the classic approach when the API is unavailable (Firefox,
// Safari) or fails for some other environmental reason (e.g. a restrictive
// iframe/permissions-policy context). An explicit user cancellation
// (AbortError) is NOT a failure to fall back from — it means "don't export
// at all".
async function exportProjectJson(project) {
  const filename = `${sanitizeFilename(project.name)}.json`;
  const text = JSON.stringify(project, null, 2);

  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: 'Projet JSON', accept: { 'application/json': ['.json'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(text);
      await writable.close();
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
      // toute autre erreur (API indisponible dans ce contexte, etc.) :
      // on retombe sur le téléchargement classique ci-dessous.
    }
  }

  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** @param {object} project the CURRENT in-memory project — always exports
 *   live state, not the last-saved snapshot. */
export function renderExportJsonButton(project) {
  const button = el('button', {
    class: 'btn',
    text: 'Exporter (JSON)',
    onClick: async () => {
      button.disabled = true;
      button.textContent = 'Export en cours…';
      try {
        await exportProjectJson(project);
      } finally {
        button.disabled = false;
        button.textContent = 'Exporter (JSON)';
      }
    },
  });
  return button;
}

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
