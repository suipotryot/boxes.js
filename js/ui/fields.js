// Small shared form-field builders — a step up from dom.js's generic
// el()/svgEl() (which know nothing about this app's .field/.field-label
// CSS convention), used by both SettingsPanel.js and ProjectListView.js so
// the same "labeled input, commits on change (blur/enter), not on every
// keystroke" pattern isn't duplicated between them.
import { el } from './dom.js';

export function numberField(labelText, value, onChange, step = '1') {
  return el('label', { class: 'field' }, [
    el('span', { class: 'field-label', text: labelText }),
    el('input', {
      type: 'number', step, min: '0', value: String(value),
      onChange: (evt) => {
        const n = Number(evt.target.value);
        if (Number.isFinite(n) && n > 0) onChange(n);
      },
    }),
  ]);
}

export function textField(labelText, value, onChange) {
  return el('label', { class: 'field' }, [
    el('span', { class: 'field-label', text: labelText }),
    el('input', {
      type: 'text', value,
      onChange: (evt) => onChange(evt.target.value),
    }),
  ]);
}
