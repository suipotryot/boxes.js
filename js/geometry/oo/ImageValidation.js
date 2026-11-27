import { t } from '../../i18n/index.js';

function hasPositiveSize(image) {
  return image.widthMm > 0 && image.heightMm > 0;
}

function isOutsideRectangle(rectWidthMm, rectHeightMm, image) {
  return image.xMm < 0
    || image.yMm < 0
    || image.xMm + image.widthMm > rectWidthMm
    || image.yMm + image.heightMm > rectHeightMm;
}

function problemsOf(rectWidthMm, rectHeightMm, image) {
  if (!hasPositiveSize(image)) return [t('validation.image.sizePositive')];
  if (isOutsideRectangle(rectWidthMm, rectHeightMm, image)) return [t('validation.image.exceedsPlate')];
  return [];
}

export function validateImageInRect(rectWidthMm, rectHeightMm, image) {
  const problems = problemsOf(rectWidthMm, rectHeightMm, image);
  return { ok: problems.length === 0, problems };
}
