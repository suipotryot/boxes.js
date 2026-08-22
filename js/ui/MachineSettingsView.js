// "Ma machine" — the user's one laser cutter, configured once instead of
// re-entered on every new project (ProjectRepository.getMachineSettings/
// setMachineSettings). Pre-fills AppShell.createAndOpenProject; never
// touches an already-created project's own copy of these fields.
//
// Unlike SettingsPanel.js, nothing here is derived from anything else (no
// validation message, no field whose display depends on another field),
// so each change just persists — the DOM is built once and left alone,
// never cleared and rebuilt on every keystroke. This isn't just a minor
// optimization: this app's clear()-then-rebuild pattern, done reactively
// on every field's own onChange, is exactly what previously let clicking
// a button right after editing an adjacent field (no Tab/blur first — an
// entirely ordinary interaction) silently lose that edit or swallow the
// click outright, once a rebuild replaced the very node mid-gesture. A
// one-time, non-reactive render sidesteps that whole hazard here rather
// than working around it.
import { el, clear } from './dom.js';
import { numberField } from './fields.js';
import { BURN_MM_HELP, LASER_WIDTH_HELP, LASER_HEIGHT_HELP, LASER_SPACING_HELP } from './fieldHelp.js';

export function mountMachineSettingsView(container, { repo }) {
  const machine = repo.getMachineSettings();

  const update = (patch) => repo.setMachineSettings({ ...repo.getMachineSettings(), ...patch });
  const updateLaserBed = (patch) => update({ laserBed: { ...repo.getMachineSettings().laserBed, ...patch } });

  clear(container);
  container.appendChild(el('div', { class: 'settings-screen' }, [
    el('h2', { text: 'Ma machine' }),
    el('p', { class: 'hint', text: 'Réglages de ta découpeuse laser, pré-remplis sur chaque nouveau projet — modifier ces valeurs n’affecte pas les projets déjà créés.' }),

    el('h3', { text: 'Découpe laser' }),
    numberField('Largeur de la zone de travail (mm)', machine.laserBed.widthMm, (n) => updateLaserBed({ widthMm: n }), '1', LASER_WIDTH_HELP),
    numberField('Hauteur de la zone de travail (mm)', machine.laserBed.heightMm, (n) => updateLaserBed({ heightMm: n }), '1', LASER_HEIGHT_HELP),
    numberField('Espacement entre pièces (mm)', machine.laserBed.spacingMm, (n) => updateLaserBed({ spacingMm: n }), '1', LASER_SPACING_HELP),
    numberField('Jeu de coupe / burn (mm)', machine.burnMm, (n) => update({ burnMm: n }), '0.01', BURN_MM_HELP),
  ]));

  return { unmount() {} };
}
