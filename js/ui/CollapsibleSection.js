import { el } from './dom.js';
import { t } from '../i18n/index.js';

// A collapsible section, open/closed state owned by EditorView.js
// (openSections/onToggleSection — same idiom as `selected`/`showLabels`)
// so it survives this panel's own frequent full rebuilds. `key` indexes
// into `openSections`; onToggleSection deliberately does NOT trigger a
// re-render on its own (see EditorView.js's own comment on that) — the
// native <details> already handles its expand/collapse visually, and
// re-rendering an already-open one from scratch on every toggle is what
// caused a real infinite loop (rebuilding + re-attaching an open
// <details> fires its own 'toggle' event again in Chromium).
export function collapsibleSection(openSections, onToggleSection, key, summaryContent, children) {
  return el('details', {
    open: openSections[key],
    ontoggle: (evt) => onToggleSection(key, evt.target.open),
  }, [el('summary', {}, [summaryContent].flat()), ...children]);
}

export function collapsibleSectionWithHelp(openSections, onToggleSection, key, title, helpText, children) {
  const helpKey = `${key}Help`;
  const helpLine = el('div', { class: 'hint section-help', text: helpText, hidden: !openSections[helpKey] });
  const toggleHelp = (evt) => {
    evt.preventDefault();
    helpLine.hidden = !helpLine.hidden;
    onToggleSection(helpKey, !helpLine.hidden);
  };
  const helpButton = el('button', {
    type: 'button', class: 'help-toggle', text: 'i', title: t('help.toggle'), 'aria-label': t('help.toggle'), onClick: toggleHelp,
  });
  return collapsibleSection(openSections, onToggleSection, key, [title, helpButton], [helpLine, ...children]);
}
