// The one shared, mutable "current locale" — read by every view module via
// t() at render time, so switching locale in Preferences is visible the
// next time any screen (re)renders, without threading a `t` parameter
// through every render function's signature. A deliberate exception to
// this codebase's usual DI-everything style (ProjectRepository's storage,
// debounce's scheduler): translation lookups happen from dozens of call
// sites across every view, and this app only ever has one active locale at
// a time, so a singleton is the pragmatic fit here.
import { createTranslator } from './translate.js';
import { fr } from './fr.js';
import { en } from './en.js';

const DICTS = { fr, en };
const DEFAULT_LOCALE = 'fr';

let activeLocale = DEFAULT_LOCALE;
let activeTranslator = createTranslator(DICTS[DEFAULT_LOCALE]);

export function setActiveLocale(locale) {
  activeLocale = DICTS[locale] ? locale : DEFAULT_LOCALE;
  activeTranslator = createTranslator(DICTS[activeLocale]);
  // Guarded the same way ProjectRepository.js guards `navigator` — this
  // module is also imported from pure-logic files with no DOM (e.g.
  // GripNotchValidation.js), and from the plain-Node test harness.
  if (typeof document !== 'undefined') document.documentElement.lang = activeLocale;
}

export function getActiveLocale() {
  return activeLocale;
}

export function t(key, params) {
  return activeTranslator(key, params);
}
