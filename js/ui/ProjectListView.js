// "Mes projets" — the app's other top-level screen alongside the editor
// (see AppShell.js). Owns its own small local state (an in-flight import's
// error or collision-choice) and rebuilds from scratch on every change,
// same convention as every other view in this app; reads repo.list() on
// each render rather than caching it, since nothing here is reactive.
import { el, clear } from './dom.js';
import { numberField } from './fields.js';
import { createDefaultProject } from '../state/Project.js';

function formatDate(updatedAt) {
  return updatedAt ? new Date(updatedAt).toLocaleString('fr-FR') : 'jamais enregistré';
}

// Deliberately lightweight: just enough to reject obvious garbage (a
// random JSON file, a truncated download) without a crash, not a full
// schema/version migration system — out of scope for M6.
function isProjectShape(obj) {
  return !!obj && typeof obj === 'object'
    && typeof obj.name === 'string'
    && !!obj.grid && Array.isArray(obj.grid.sx) && Array.isArray(obj.grid.sy);
}

function exportProject(project) {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const filename = `${(project.name || 'projet').replace(/[^\w-]+/g, '_')}.json`;
  const link = el('a', { href: url, download: filename });
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function mountProjectListView(container, { repo, onOpen, onCreate }) {
  // { error: string } | { collision: { merged, existing } } | null
  let importState = null;

  function finishImport(project) {
    const saved = repo.save(project);
    importState = null;
    onOpen(saved.id);
  }

  async function handleFile(file) {
    importState = null;
    let parsed;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      importState = { error: 'Fichier JSON invalide — impossible de le lire.' };
      render();
      return;
    }
    if (!isProjectShape(parsed)) {
      importState = { error: 'Ce fichier ne ressemble pas à un projet boxes.js.' };
      render();
      return;
    }
    // Shallow-merge over the current defaults so a file exported by an
    // older version, missing a top-level field added since, still opens.
    const merged = { ...createDefaultProject(), ...parsed };
    const existing = merged.id ? repo.load(merged.id) : null;
    if (existing) {
      importState = { collision: { merged, existing } };
      render();
    } else {
      finishImport(merged);
    }
  }

  function renderImportFeedback() {
    if (!importState) return null;
    if (importState.error) {
      return el('div', { class: 'field' }, [el('span', { class: 'warning', text: importState.error })]);
    }
    const { merged, existing } = importState.collision;
    return el('div', { class: 'import-collision' }, [
      el('p', { class: 'hint', text: `Un projet avec cet id existe déjà : "${existing.name}" (modifié le ${formatDate(existing.updatedAt)}).` }),
      el('button', { class: 'btn btn-danger', text: 'Remplacer le projet existant', onClick: () => finishImport({ ...merged, id: existing.id }) }),
      el('button', { class: 'btn', text: 'Importer comme copie', onClick: () => finishImport({ ...merged, id: null }) }),
      el('button', { class: 'btn', text: 'Annuler', onClick: () => { importState = null; render(); } }),
    ]);
  }

  function renderRow(meta) {
    const project = repo.load(meta.id);
    return el('div', { class: 'project-row' }, [
      el('button', { class: 'btn project-open', text: meta.name || '(sans nom)', onClick: () => onOpen(meta.id) }),
      el('span', { class: 'hint', text: formatDate(meta.updatedAt) }),
      el('button', { class: 'btn', text: 'Exporter', onClick: () => exportProject(project) }),
      el('button', {
        class: 'btn btn-danger', text: 'Supprimer',
        onClick: () => {
          if (window.confirm(`Supprimer « ${meta.name || '(sans nom)'} » ? Cette action est irréversible.`)) {
            repo.remove(meta.id);
            render();
          }
        },
      }),
    ]);
  }

  function render() {
    clear(container);
    const projects = repo.list();

    const fileInput = el('input', {
      type: 'file', accept: '.json', class: 'visually-hidden',
      onChange: (evt) => {
        const file = evt.target.files[0];
        evt.target.value = ''; // allow re-selecting the same file later
        if (file) handleFile(file);
      },
    });

    const toolbar = el('div', { class: 'toolbar' }, [
      el('div', { class: 'toolbar-group' }, [
        el('button', { class: 'btn', text: 'Nouveau projet', onClick: onCreate }),
        el('button', { class: 'btn', text: 'Importer un fichier JSON…', onClick: () => fileInput.click() }),
        fileInput,
      ]),
      numberField('Délai de sauvegarde automatique (s)', repo.getAutosaveDelayMs() / 1000, (s) => repo.setAutosaveDelayMs(s * 1000)),
    ]);

    const body = projects.length === 0
      ? el('p', { class: 'hint', text: 'Aucun projet pour l’instant — créez-en un ou importez un fichier JSON.' })
      : el('div', { class: 'project-rows' }, projects.map(renderRow));

    container.appendChild(el('div', { class: 'project-list' }, [
      el('h2', { text: 'Mes projets' }),
      toolbar,
      renderImportFeedback(),
      body,
    ]));
  }

  render();

  // No global listeners here (unlike EditorView's keydown handler), so
  // there's nothing to actually tear down — kept for API symmetry with
  // EditorView.mountEditorView, since AppShell treats both screens the
  // same way when switching between them.
  return { unmount() {} };
}
