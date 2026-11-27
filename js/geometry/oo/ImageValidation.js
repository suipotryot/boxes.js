import { t } from '../../i18n/index.js';

function exceedsRectangle(rectWidthMm, rectHeightMm, image) {
  return image.xMm < 0
    || image.yMm < 0
    || image.xMm + image.widthMm > rectWidthMm
    || image.yMm + image.heightMm > rectHeightMm;
}

export function validateImageInRect(rectWidthMm, rectHeightMm, image) {
  const problems = exceedsRectangle(rectWidthMm, rectHeightMm, image)
    ? [t('validation.image.exceedsPlate')]
    : [];
  return { ok: problems.length === 0, problems };
}
