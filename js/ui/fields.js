// Small shared form-field builders — a step up from dom.js's generic
// el()/svgEl() (which know nothing about this app's .field/.field-label
// CSS convention), used by both SettingsPanel.js and ProjectListView.js so
// the same "labeled input, commits on change (blur/enter), not on every
// keystroke" pattern isn't duplicated between them.
import { el, svgEl } from './dom.js';

// A small circled "i" carrying its explanation in `data-tooltip`, shown on
// hover/focus by CSS alone (see .info-icon in style.css) — kept out of the
// DOM entirely when no tooltip text is given, rather than rendering an
// empty/dead icon, so a field without one just has no icon at all.
export function infoIcon(tooltip) {
  if (!tooltip) return null;
  return el('span', { class: 'info-icon', 'data-tooltip': tooltip, tabindex: '0', text: 'i' });
}

// A minimal stroke-only trash pictogram (matches infoIcon's philosophy of a
// plain small glyph, no icon font/library) — shared by GripNotchEditor.js
// and HoleEditor.js, the app's two "list of removable line items" panels.
export function trashIcon() {
  return svgEl('svg', { viewBox: '0 0 24 24', class: 'icon-btn-svg', 'aria-hidden': 'true' }, [
    svgEl('polyline', { points: '3 6 5 6 21 6' }),
    svgEl('path', { d: 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' }),
    svgEl('line', { x1: '10', y1: '11', x2: '10', y2: '17' }),
    svgEl('line', { x1: '14', y1: '11', x2: '14', y2: '17' }),
  ]);
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
