import { Cutout } from './Cutout.js';

const MILLIMETRES_PER_UNIT = { mm: 1, cm: 10, in: 25.4, px: 25.4 / 96, pt: 25.4 / 72, '': 25.4 / 96 };
const LENGTH_PATTERN = /^([\d.]+)(mm|cm|in|px|pt)?$/;

function convertToMillimetres(lengthText) {
  const match = lengthText.match(LENGTH_PATTERN);
  if (!match) throw new Error(`Unsupported SVG length "${lengthText}": use mm, cm, in, pt or px`);
  const [, amount, unit = ''] = match;
  return Number(amount) * MILLIMETRES_PER_UNIT[unit];
}

export function readAttribute(svgText, attributeName) {
  const match = svgText.match(new RegExp(String.raw`<svg[^>]*\s${attributeName}=(?:"([^"]*)"|'([^']*)')`));
  return match ? (match[1] ?? match[2]) : null;
}

function hasWidthAndHeight(svgText) {
  return readAttribute(svgText, 'width') !== null && readAttribute(svgText, 'height') !== null;
}

function readViewBoxSizeMm(svgText) {
  if (readAttribute(svgText, 'viewBox') === null) {
    throw new Error('The SVG has no readable size: width/height or viewBox is required');
  }
  const [, , width, height] = readAttribute(svgText, 'viewBox').trim().split(/[\s,]+/);
  return { widthMm: convertToMillimetres(width), heightMm: convertToMillimetres(height) };
}

function assertIsSvg(svgText) {
  if (!/<svg[\s>]/.test(svgText)) {
    throw new Error('The pasted text is not an SVG: no <svg> element found');
  }
}

function assertIsPositive(size) {
  if (!(size.widthMm > 0 && size.heightMm > 0)) {
    throw new Error(`The SVG has no usable size: ${size.widthMm} x ${size.heightMm} mm`);
  }
  return size;
}

function readDeclaredSizeMm(svgText) {
  if (!hasWidthAndHeight(svgText)) return readViewBoxSizeMm(svgText);
  return {
    widthMm: convertToMillimetres(readAttribute(svgText, 'width')),
    heightMm: convertToMillimetres(readAttribute(svgText, 'height')),
  };
}

export function readSvgSizeMm(svgText) {
  assertIsSvg(svgText);
  return assertIsPositive(readDeclaredSizeMm(svgText));
}

export class EngravedImage {
  constructor({ xMm, yMm, widthMm, heightMm, svg }) {
    this.xMm = xMm;
    this.yMm = yMm;
    this.widthMm = widthMm;
    this.heightMm = heightMm;
    this.svg = svg;
  }

  withChanges(patch) {
    return new EngravedImage({ ...this, ...patch });
  }

  movedBy(dx, dy) {
    return this.withChanges({ xMm: this.xMm + dx, yMm: this.yMm + dy });
  }

  toTextLine() {
    return [this.xMm, this.yMm, this.widthMm, this.heightMm].join(', ');
  }

  static placementFromTextLine(text) {
    const numbers = Cutout.parseNumbers(text, 4);
    if (!numbers) return null;
    const [xMm, yMm, widthMm, heightMm] = numbers;
    return { xMm, yMm, widthMm, heightMm };
  }

  static replaceAt(images, index, patch) {
    return images.map((image, i) => (i === index ? image.withChanges(patch) : image));
  }

  static listFor(pieceImages, pieceId) {
    return ((pieceImages && pieceImages[pieceId]) || []).map((image) => new EngravedImage(image));
  }

  static centeredIn(svg, areaWidthMm, areaHeightMm) {
    const { widthMm, heightMm } = readSvgSizeMm(svg);
    return new EngravedImage({
      xMm: (areaWidthMm - widthMm) / 2,
      yMm: (areaHeightMm - heightMm) / 2,
      widthMm,
      heightMm,
      svg,
    });
  }
}
