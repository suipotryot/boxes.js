import { el } from './dom.js';
import { trashIcon } from './fields.js';
import { Cutout } from '../geometry/oo/Cutout.js';
import { EngravedImage } from '../geometry/oo/EngravedImage.js';
import { validateImageInRect } from '../geometry/oo/ImageValidation.js';
import { wallHoleSpan } from '../geometry/oo/HoleValidation.js';
import { t } from '../i18n/index.js';
import { readImageInput } from '../image/ImageInput.js';
import { requestEngravingImage } from '../image/EngravingImageRequest.js';
import { browserEngravingEnvironment } from '../image/BrowserEngravingEnvironment.js';
import { assertWellFormedSvg } from '../image/assertWellFormedSvg.js';

const START_OF_WALL = { xMm: 0, widthMm: 0 };

function plateSizeMm(context, spanOnPlate = START_OF_WALL) {
  if (context.kind === 'flat') return { widthMm: context.widthMm, heightMm: context.heightMm };
  const { height } = wallHoleSpan(context.run, context.grid, context.project, spanOnPlate);
  return { widthMm: context.run.length, heightMm: height };
}

function renderLineField(image, onUpdate) {
  const unreadableLineMessage = el('span', { class: 'warning' });
  const input = el('input', {
    type: 'text', value: image.toTextLine(),
    onChange: (evt) => {
      const placement = EngravedImage.placementFromTextLine(evt.target.value);
      evt.target.classList.toggle('invalid-input', !placement);
      unreadableLineMessage.textContent = placement ? '' : t('image.lineUnreadable');
      if (placement) onUpdate(placement);
    },
  });
  return el('label', { class: 'field' }, [input, unreadableLineMessage]);
}

function renderOneImage(image, context, onUpdate, onRemove) {
  const lineField = renderLineField(image, onUpdate);
  const trashButton = el('button', {
    class: 'icon-btn', title: t('image.delete'), 'aria-label': t('image.delete'), onClick: onRemove,
  }, [trashIcon()]);

  const { widthMm, heightMm } = plateSizeMm(context, image);
  const validation = validateImageInRect(widthMm, heightMm, image);
  const warning = validation.ok ? null : el('div', { class: 'field' }, validation.problems.map((message) => el('span', { class: 'warning', text: message })));

  return el('div', { class: 'compact-item' }, [el('div', { class: 'compact-item-row' }, [lineField, trashButton]), warning]);
}

function renderImageInput(context, onAdd) {
  const textarea = el('textarea', { rows: '4', placeholder: t('image.inputPlaceholder') });
  const errorLine = el('span', { class: 'warning' });
  const addButton = el('button', { class: 'btn', text: t('image.add') });

  const showFailure = (messageKey, error) => {
    addButton.disabled = false;
    addButton.textContent = t('image.add');
    errorLine.textContent = t(messageKey, { reason: error.message });
  };
  const addPastedSvg = (svg) => {
    try {
      const plate = plateSizeMm(context);
      onAdd(EngravedImage.centeredIn(svg, plate.widthMm, plate.heightMm));
    } catch (error) {
      showFailure('image.invalidSvg', error);
    }
  };
  const addLoadedImage = (loadedImage) => {
    try {
      assertWellFormedSvg(loadedImage.svg);
      const plate = plateSizeMm(context);
      onAdd(EngravedImage.centeredWithSize(loadedImage, plate.widthMm, plate.heightMm));
    } catch (error) {
      showFailure('image.urlFailed', error);
    }
  };
  const loadFromUrl = (url) => {
    addButton.disabled = true;
    addButton.textContent = t('image.urlLoading');
    requestEngravingImage(url, browserEngravingEnvironment, {
      onImage: addLoadedImage,
      onError: (error) => showFailure('image.urlFailed', error),
    });
  };
  const readInputOrShowFailure = (text) => {
    try {
      return readImageInput(text);
    } catch (error) {
      showFailure('image.unreadableInput', error);
      return null;
    }
  };
  addButton.addEventListener('click', () => {
    errorLine.textContent = '';
    const input = readInputOrShowFailure(textarea.value);
    if (input === null) return;
    if (input.kind === 'svg') addPastedSvg(input.svg);
    else loadFromUrl(input.url);
  });
  return el('div', { class: 'field' }, [textarea, addButton, errorLine]);
}

function withImageAppended(project, pieceId, image) {
  const imagesOfPiece = project.pieceImages[pieceId] ?? [];
  return { ...project, pieceImages: { ...project.pieceImages, [pieceId]: [...imagesOfPiece, image] } };
}

export function renderImageSection(project, pieceId, context, store, selectedIndex, wrapInCollapsible) {
  const images = EngravedImage.listFor(project.pieceImages, pieceId);
  const setList = (nextList) => store.apply((p) => ({ ...p, pieceImages: { ...p.pieceImages, [pieceId]: nextList } }));
  const appendImage = (image) => store.apply((p) => withImageAppended(p, pieceId, image));
  const updateAt = (index, patch) => setList(Cutout.replaceAt(images, index, patch));
  const removeAt = (index) => setList(images.filter((_, i) => i !== index));

  const selectedImage = selectedIndex == null ? START_OF_WALL : images[selectedIndex];
  const { widthMm, heightMm } = plateSizeMm(context, selectedImage);
  const centerSelectedImageOn = (axis, areaLengthMm) => updateAt(selectedIndex, images[selectedIndex].centeredOn(axis, areaLengthMm));
  const centerButton = (axis, labelKey, areaLengthMm) => el('button', {
    class: 'btn', text: t(labelKey), disabled: selectedIndex == null,
    onClick: () => centerSelectedImageOn(axis, areaLengthMm),
  });
  const centerButtons = el('div', { class: 'button-row' }, [
    centerButton('x', 'image.centerX', widthMm),
    centerButton('y', 'image.centerY', heightMm),
  ]);

  return wrapInCollapsible(t('image.title'), t('image.help'), [
    centerButtons,
    ...images.map((image, index) => renderOneImage(image, context, (patch) => updateAt(index, patch), () => removeAt(index))),
    renderImageInput(context, appendImage),
  ]);
}
