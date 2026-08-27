// Tooltip text for fields that appear identically in more than one screen
// — finger-joint dimensions (SettingsPanel.js's own project settings AND
// PreferencesView.js's user-level defaults for them) and laser-bed/burn
// (SettingsPanel.js AND MachineSettingsView.js) — defined once so the
// wording can't drift between two screens describing the exact same
// underlying value. Screen-specific fields (project name, grid, lid,
// autosave delay…) keep their tooltip text inline at their own call site
// instead, since nothing else needs to match it.
//
// Each is a function, not a plain string, so it re-reads the active locale
// (js/i18n/index.js) at call time — every call site is inside some view's
// render(), so this stays in sync the same way the rest of that view's own
// text does.
import { t } from '../i18n/index.js';

export const FINGER_MM_HELP = () => t('help.fingerMm');
export const SPACE_MM_HELP = () => t('help.spaceMm');
export const MARGIN_MM_HELP = () => t('help.marginMm');
// See FingerJoint.js's own fingerEdgePath(): play shrinks each dent and
// grows each espace by this same amount — this text mirrors that exactly,
// not a guess at the intent from the field's name alone.
export const PLAY_MM_HELP = () => t('help.playMm');
export const BURN_MM_HELP = () => t('help.burnMm');
export const LASER_WIDTH_HELP = () => t('help.laserWidth');
export const LASER_HEIGHT_HELP = () => t('help.laserHeight');
export const LASER_SPACING_HELP = () => t('help.laserSpacing');
export const DRAWER_PLAY_HELP = () => t('help.drawerPlay');
export const DRAWER_THICKNESS_HELP = () => t('help.drawerThickness');
