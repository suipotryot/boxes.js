// Small shared form-field builders — a step up from dom.js's generic
// el()/svgEl() (which know nothing about this app's .field/.field-label
// CSS convention), used by both SettingsPanel.js and ProjectListView.js so
// the same "labeled input, commits on change (blur/enter), not on every
// keystroke" pattern isn't duplicated between them.
import { el } from './dom.js';

// A small circled "i" carrying its explanation in `data-tooltip`, shown on
// hover/focus by CSS alone (see .info-icon in style.css) — kept out of the
// DOM entirely when no tooltip text is given, rather than rendering an
// empty/dead icon, so a field without one just has no icon at all.
export function infoIcon(tooltip) {
  if (!tooltip) return null;
  return el('span', { class: 'info-icon', 'data-tooltip': tooltip, tabindex: '0', text: 'i' });
}

export function numberField(labelText, value, onChange, step = '1', tooltip) {
  return el('label', { class: 'field' }, [
    el('span', { class: 'field-label' }, [labelText, infoIcon(tooltip)]),
    el('input', {
      type: 'number', step, min: '0', value: String(value),
      onChange: (evt) => {
        const n = Number(evt.target.value);
        if (Number.isFinite(n) && n > 0) onChange(n);
      },
    }),
  ]);
}

export function textField(labelText, value, onChange, tooltip) {
  return el('label', { class: 'field' }, [
    el('span', { class: 'field-label' }, [labelText, infoIcon(tooltip)]),
    el('input', {
      type: 'text', value,
      onChange: (evt) => onChange(evt.target.value),
    }),
  ]);
}
