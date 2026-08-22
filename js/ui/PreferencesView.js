// "Préférences" — user-level finger-joint defaults, configured once
// instead of re-entered on every new project (ProjectRepository.
// getPreferences/setPreferences). Pre-fills AppShell.createAndOpenProject;
// never touches an already-created project's own copy of these fields.
//
// Built once, not re-rendered reactively on every change — see
// MachineSettingsView.js's identical header comment for why: nothing here
// is derived from anything else, so there's no reason to clear()+rebuild
// on every keystroke, and doing so is what previously made clicking a
// button right after editing a field (no Tab/blur first) able to silently
// lose that edit or swallow the click.
import { el, clear } from './dom.js';
import { numberField } from './fields.js';

export function mountPreferencesView(container, { repo }) {
  const prefs = repo.getPreferences();

  const updateFingerJoint = (patch) => {
    const current = repo.getPreferences();
    repo.setPreferences({ ...current, fingerJoint: { ...current.fingerJoint, ...patch } });
  };

  clear(container);
  container.appendChild(el('div', { class: 'settings-screen' }, [
    el('h2', { text: 'Préférences' }),
    el('p', { class: 'hint', text: 'Valeurs par défaut pré-remplies sur chaque nouveau projet — modifier ces valeurs n’affecte pas les projets déjà créés.' }),

    el('h3', { text: 'Doigts (finger joint)' }),
    numberField('Largeur doigt (mm)', prefs.fingerJoint.fingerMm, (n) => updateFingerJoint({ fingerMm: n })),
    numberField('Largeur espace (mm)', prefs.fingerJoint.spaceMm, (n) => updateFingerJoint({ spaceMm: n })),
    numberField('Marge min. (mm)', prefs.fingerJoint.marginMm, (n) => updateFingerJoint({ marginMm: n })),
    numberField('Jeu (play, mm)', prefs.fingerJoint.playMm, (n) => updateFingerJoint({ playMm: n }), '0.01'),
  ]));

  return { unmount() {} };
}
