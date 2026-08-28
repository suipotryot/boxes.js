// The one global control that lives outside #editor-root entirely (see
// AppShell.js's own comment on why) — mounted once into index.html's
// static header, so it's present unchanged across every screen instead of
// being duplicated into each view. Flag emoji rather than an SVG icon or a
// text label: a real "drawn flag" with zero new dependency, in the same
// no-icon-library spirit as fields.js's trashIcon()/homeIcon().
//
// Each button's label is the NAME of the language it switches to, always
// in that language itself ("Français" stays "Français" no matter which
// language is currently active) — a language's own name isn't something
// to translate, so this needs no i18n dictionary entry.
import { el, clear } from './dom.js';
import { getActiveLocale } from '../i18n/index.js';

const LOCALES = [
  { value: 'fr', flag: '🇫🇷', label: 'Français' },
  { value: 'en', flag: '🇬🇧', label: 'English' },
];

export function mountLanguageSwitcher(container, { repo, onChange }) {
  function render() {
    const active = getActiveLocale();
    clear(container);
    container.appendChild(el('div', { class: 'lang-switcher' }, LOCALES.map((locale) => el('button', {
      class: locale.value === active ? 'lang-flag active' : 'lang-flag',
      title: locale.label,
      'aria-label': locale.label,
      disabled: locale.value === active,
      text: locale.flag,
      onClick: () => {
        repo.setLocale(locale.value);
        onChange(locale.value);
        render();
      },
    }))));
  }

  render();

  return { unmount() {} };
}
