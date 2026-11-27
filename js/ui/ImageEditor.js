import { el } from './dom.js';
import { infoIcon, trashIcon } from './fields.js';
import { EngravedImage } from '../geometry/oo/EngravedImage.js';
import { validateImageInRect } from '../geometry/oo/ImageValidation.js';
import { wallHoleSpan } from '../geometry/oo/HoleValidation.js';
import { centerOnAxis } from '../geometry/oo/CutoutAlignment.js';
import { t } from '../i18n/index.js';

const LEFT_END_OF_WALL = { xMm: 0, widthMm: 0 };

function plateSizeMm(context, imageSpan = LEFT_END_OF_WALL) {
  if (context.kind === 'flat') return { widthMm: context.widthMm, heightMm: context.heightMm };
  return { widthMm: context.run.length, heightMm: wallHoleSpan(context.run, context.grid, context.project, imageSpan).height };
}

function renderOneImage(image, context, onUpdate, onRemove) {
  const lineField = el('label', { class: 'field' }, [
    el('input', {
      type: 'text', value: image.toTextLine(),
      onChange: (evt) => {
        const placement = EngravedImage.placementFromTextLine(evt.target.value);
        if (!placement) { evt.target.classList.add('invalid-input'); return; }
        evt.target.classList.remove('invalid-input');
        onUpdate(placement);
      },
    }),
  ]);
  const trashButton = el('button', {
    class: 'icon-btn', title: t('image.delete'), 'aria-label': t('image.delete'), onClick: onRemove,
  }, [trashIcon()]);

  const { widthMm, heightMm } = plateSizeMm(context, image);
  const validation = validateImageInRect(widthMm, heightMm, image);
  const warning = validation.ok ? null : el('div', { class: 'field' }, validation.problems.map((message) => el('span', { class: 'warning', text: message })));

  return el('div', { class: 'compact-item' }, [el('div', { class: 'compact-item-row' }, [lineField, trashButton]), warning]);
}

function renderPasteArea(context, onAdd) {
  const textarea = el('textarea', { rows: '4', placeholder: t('image.pastePlaceholder') });
  const errorLine = el('span', { class: 'warning' });
  const addButton = el('button', {
    class: 'btn', text: t('image.add'),
    onClick: () => {
      try {
        const { widthMm, heightMm } = plateSizeMm(context);
        onAdd(EngravedImage.centeredIn(textarea.value, widthMm, heightMm));
        errorLine.textContent = '';
      } catch (error) {
        errorLine.textContent = t('image.invalidSvg', { reason: error.message });
      }
    },
  });
  return el('div', { class: 'field' }, [textarea, addButton, errorLine]);
}

export function renderImageSection(project, pieceId, context, store, selectedIndex) {
  const images = EngravedImage.listFor(project.pieceImages, pieceId);
  const setList = (nextList) => store.apply((p) => ({ ...p, pieceImages: { ...p.pieceImages, [pieceId]: nextList } }));
  const updateAt = (index, patch) => setList(EngravedImage.replaceAt(images, index, patch));
  const removeAt = (index) => setList(images.filter((_, i) => i !== index));

  const selectedImage = selectedIndex == null ? LEFT_END_OF_WALL : images[selectedIndex];
  const { widthMm, heightMm } = plateSizeMm(context, selectedImage);
  const centerButtons = el('div', { class: 'button-row' }, [
    el('button', {
      class: 'btn', text: t('image.centerX'), disabled: selectedIndex == null,
      onClick: () => {
        const [centered] = centerOnAxis([images[selectedIndex]], widthMm, (i) => i.widthMm, (i, start) => i.withChanges({ xMm: start }));
        updateAt(selectedIndex, { xMm: centered.xMm });
      },
    }),
    el('button', {
      class: 'btn', text: t('image.centerY'), disabled: selectedIndex == null,
      onClick: () => {
        const [centered] = centerOnAxis([images[selectedIndex]], heightMm, (i) => i.heightMm, (i, start) => i.withChanges({ yMm: start }));
        updateAt(selectedIndex, { yMm: centered.yMm });
      },
    }),
  ]);

  return el('div', { class: 'inspector-section' }, [
    el('div', { class: 'field-label' }, [t('image.title'), infoIcon(t('image.help'))]),
    el('div', { class: 'hint', text: t('image.fieldOrderHint') }),
    centerButtons,
    ...images.map((image, index) => renderOneImage(image, context, (patch) => updateAt(index, patch), () => removeAt(index))),
    renderPasteArea(context, (image) => setList([...images, image])),
  ]);
}
