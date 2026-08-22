// "Préférences" — user-level finger-joint defaults (configured once
// instead of re-entered on every new project — ProjectRepository.
// getPreferences/setPreferences, pre-fills AppShell.createAndOpenProject,
// never touches an already-created project's own copy of these fields)
// alongside the autosave delay, an app-wide behavior setting rather than
// a per-project prefill (ProjectRepository.getAutosaveDelayMs, moved here
// from ProjectListView.js's own toolbar — same repository method either
// way, just relocated to sit with the rest of this app's preferences).
//
// Built once, not re-rendered reactively on every change — see
// MachineSettingsView.js's identical header comment for why: nothing here
// is derived from anything else, so there's no reason to clear()+rebuild
// on every keystroke, and doing so is what previously made clicking a
// button right after editing a field (no Tab/blur first) able to silently
// lose that edit or swallow the click.
import { el, clear } from './dom.js';
import { numberField } from './fields.js';
import { FINGER_MM_HELP, SPACE_MM_HELP, MARGIN_MM_HELP, PLAY_MM_HELP } from './fieldHelp.js';

export function mountPreferencesView(container, { repo }) {
  const prefs = repo.getPreferences();

  const updateFingerJoint = (patch) => {
    const current = repo.getPreferences();
    repo.setPreferences({ ...current, fingerJoint: { ...current.fingerJoint, ...patch } });
  };

  clear(container);
  container.appendChild(el('div', { class: 'settings-screen' }, [
    el('h2', { text: 'Préférences' }),

    el('h3', { text: 'Doigts (finger joint)' }),
    el('p', { class: 'hint', text: 'Valeurs par défaut pré-remplies sur chaque nouveau projet — modifier ces valeurs n’affecte pas les projets déjà créés.' }),
    numberField('Largeur doigt (mm)', prefs.fingerJoint.fingerMm, (n) => updateFingerJoint({ fingerMm: n }), '1', FINGER_MM_HELP),
    numberField('Largeur espace (mm)', prefs.fingerJoint.spaceMm, (n) => updateFingerJoint({ spaceMm: n }), '1', SPACE_MM_HELP),
    numberField('Marge min. (mm)', prefs.fingerJoint.marginMm, (n) => updateFingerJoint({ marginMm: n }), '1', MARGIN_MM_HELP),
    numberField('Jeu (play, mm)', prefs.fingerJoint.playMm, (n) => updateFingerJoint({ playMm: n }), '0.01', PLAY_MM_HELP),

    el('h3', { text: 'Sauvegarde' }),
    numberField('Délai de sauvegarde automatique (s)', repo.getAutosaveDelayMs() / 1000, (s) => repo.setAutosaveDelayMs(s * 1000), '1', 'Temps d’inactivité après une modification avant l’enregistrement automatique du projet en cours d’édition.'),
  ]));

  return { unmount() {} };
}
