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
  const viewBox = readAttribute(svgText, 'viewBox');
  if (viewBox === null) {
    throw new Error('The SVG has no readable size: width/height or viewBox is required');
  }
  const [, , width, height] = viewBox.trim().split(/[\s,]+/);
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

const CENTERING_AXES = {
  x: { startField: 'xMm', sizeField: 'widthMm' },
  y: { startField: 'yMm', sizeField: 'heightMm' },
};

export class EngravedImage {
  constructor({ xMm, yMm, widthMm, heightMm, svg, rotationDeg = 0 }) {
    this.xMm = xMm;
    this.yMm = yMm;
    this.widthMm = widthMm;
    this.heightMm = heightMm;
    this.svg = svg;
    this.rotationDeg = rotationDeg;
  }

  isTurnedSideways() {
    return this.rotationDeg % 180 !== 0;
  }

  contentSize() {
    return this.isTurnedSideways()
      ? { widthMm: this.heightMm, heightMm: this.widthMm }
      : { widthMm: this.widthMm, heightMm: this.heightMm };
  }

  rotatedQuarterTurn() {
    const centerX = this.xMm + this.widthMm / 2;
    const centerY = this.yMm + this.heightMm / 2;
    return this.withChanges({
      rotationDeg: (this.rotationDeg + 90) % 360,
      widthMm: this.heightMm,
      heightMm: this.widthMm,
      xMm: centerX - this.heightMm / 2,
      yMm: centerY - this.widthMm / 2,
    });
  }

  withChanges(patch) {
    return new EngravedImage({ ...this, ...patch });
  }

  movedBy(dx, dy) {
    return this.withChanges({ xMm: this.xMm + dx, yMm: this.yMm + dy });
  }

  resizedToward(targetPoint, minSizeMm) {
    return this.withChanges({
      widthMm: Math.max(minSizeMm, targetPoint.x - this.xMm),
      heightMm: Math.max(minSizeMm, targetPoint.y - this.yMm),
    });
  }

  centeredOn(axis, areaLengthMm) {
    const { startField, sizeField } = CENTERING_AXES[axis];
    return this.withChanges({ [startField]: (areaLengthMm - this[sizeField]) / 2 });
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

  static listFor(pieceImages, pieceId) {
    const storedImages = pieceImages?.[pieceId] ?? [];
    return storedImages.map((image) => new EngravedImage(image));
  }

  static centeredWithSize({ svg, widthMm, heightMm }, areaWidthMm, areaHeightMm) {
    return new EngravedImage({
      xMm: (areaWidthMm - widthMm) / 2,
      yMm: (areaHeightMm - heightMm) / 2,
      widthMm,
      heightMm,
      svg,
    });
  }

  static centeredIn(svg, areaWidthMm, areaHeightMm) {
    return EngravedImage.centeredWithSize({ svg, ...readSvgSizeMm(svg) }, areaWidthMm, areaHeightMm);
  }
}
