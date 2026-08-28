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
import { numberField, selectField } from './fields.js';
import { FINGER_MM_HELP, SPACE_MM_HELP, MARGIN_MM_HELP, PLAY_MM_HELP } from './fieldHelp.js';
import { setActiveLocale, getActiveLocale, t } from '../i18n/index.js';

export function mountPreferencesView(container, { repo, onBackToList }) {
  const updateFingerJoint = (patch) => {
    const current = repo.getPreferences();
    repo.setPreferences({ ...current, fingerJoint: { ...current.fingerJoint, ...patch } });
  };

  // The one field on this otherwise non-reactive screen (see this file's
  // own header comment) that needs a rebuild the moment it changes: every
  // other label on this very screen is text that this field controls.
  function render() {
    const prefs = repo.getPreferences();

    clear(container);
    container.appendChild(el('div', { class: 'settings-screen' }, [
      el('h2', { text: t('shared.preferencesTitle') }),

      el('h3', { text: t('shared.fingerJointSection') }),
      el('p', { class: 'hint', text: t('preferences.hint') }),
      numberField(t('field.fingerMm'), prefs.fingerJoint.fingerMm, (n) => updateFingerJoint({ fingerMm: n }), '1', FINGER_MM_HELP()),
      numberField(t('field.spaceMm'), prefs.fingerJoint.spaceMm, (n) => updateFingerJoint({ spaceMm: n }), '1', SPACE_MM_HELP()),
      numberField(t('field.marginMm'), prefs.fingerJoint.marginMm, (n) => updateFingerJoint({ marginMm: n }), '1', MARGIN_MM_HELP()),
      numberField(t('field.playMm'), prefs.fingerJoint.playMm, (n) => updateFingerJoint({ playMm: n }), '0.01', PLAY_MM_HELP()),

      el('h3', { text: t('preferences.saveSection') }),
      numberField(t('preferences.autosaveDelay'), repo.getAutosaveDelayMs() / 1000, (s) => repo.setAutosaveDelayMs(s * 1000), '1', t('preferences.autosaveDelayHelp')),

      el('h3', { text: t('preferences.languageSection') }),
      selectField(t('preferences.language'), [
        { value: 'fr', label: t('preferences.languageFr') },
        { value: 'en', label: t('preferences.languageEn') },
      ], getActiveLocale(), (locale) => {
        repo.setLocale(locale);
        setActiveLocale(locale);
        render();
      }),

      el('button', { class: 'btn', text: t('shared.save'), onClick: onBackToList }),
    ]));
  }

  render();

  return { unmount() {} };
}
