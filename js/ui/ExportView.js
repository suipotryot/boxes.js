// Multi-page SVG export (M7) — a toolbar-mounted button (renderExportButton,
// next to "Mes projets"), plus renderExportDeepnestButton for a second,
// Deepnest-oriented variant whose page-boundary rect sits beside the packed
// pieces instead of enclosing them (see SvgPageRenderer.js's
// computeDeepnestBoundaryLayout for why: an enclosing rect makes Deepnest's
// SVG importer read the pieces as holes of one compound part instead of a
// list of separate parts to nest). The "Étiqueter les pièces" toggle itself
// now lives in SettingsPanel.js's Options section — EditorView still owns
// the showLabels state, just threads it to more places than before. Also
// hosts the whole-project JSON export button (renderExportJsonButton) — a
// different export entirely (the full project state, not cut pieces) but
// the same toolbar "export" idiom, so it lives alongside the SVG ones
// rather than in its own file.
import { el } from './dom.js';
import { exportProjectSvg, exportProjectSvgForDeepnest, sanitizeFilename } from '../export/ExportPipeline.js';
import { t } from '../i18n/index.js';

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
        types: [{ description: t('export.jsonFileType'), accept: { 'application/json': ['.json'] } }],
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
    text: t('export.exportJson'),
    onClick: async () => {
      button.disabled = true;
      button.textContent = t('export.inProgress');
      try {
        await exportProjectJson(project);
      } finally {
        button.disabled = false;
        button.textContent = t('export.exportJson');
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
    text: t('export.exportSvg'),
    onClick: async () => {
      button.disabled = true;
      button.textContent = t('export.inProgress');
      try {
        await exportProjectSvg(project, { labels: showLabels });
      } finally {
        button.disabled = false;
        button.textContent = t('export.exportSvg');
      }
    },
  });
  return button;
}

/**
 * @param {object} project
 * @param {boolean} showLabels same idiom/value as renderExportButton — keeps
 *   this export an honest representation of the live preview.
 */
export function renderExportDeepnestButton(project, showLabels) {
  const button = el('button', {
    class: 'btn',
    text: t('export.exportSvgDeepnest'),
    onClick: async () => {
      button.disabled = true;
      button.textContent = t('export.inProgress');
      try {
        await exportProjectSvgForDeepnest(project, { labels: showLabels });
      } finally {
        button.disabled = false;
        button.textContent = t('export.exportSvgDeepnest');
      }
    },
  });
  return button;
}
