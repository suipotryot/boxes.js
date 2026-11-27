import { readAttribute, readSvgSizeMm } from '../geometry/oo/EngravedImage.js';

const PIXELS_PER_MILLIMETRE = 96 / 25.4;

function prefixDeclarationsOf(svgText) {
  const openingTag = svgText.slice(svgText.indexOf('<svg'), svgText.indexOf('>', svgText.indexOf('<svg')));
  return (openingTag.match(/xmlns:\w+="[^"]*"/g) || []).map((declaration) => `${declaration} `).join('');
}

const ACTIVE_ELEMENTS = ['script', 'foreignObject', 'iframe', 'embed', 'object'];

function withoutElement(content, elementName) {
  const selfClosing = String.raw`<${elementName}\b[^>]*/>`;
  const withBody = String.raw`<${elementName}\b[^>]*>[\s\S]*?</${elementName}>`;
  return content.replace(new RegExp(`${selfClosing}|${withBody}`, 'gi'), '');
}

function withoutActiveElements(content) {
  return ACTIVE_ELEMENTS.reduce(withoutElement, content);
}

const EVENT_HANDLER_ATTRIBUTE = /\son\w+\s*=\s*("[^"]*"|'[^']*')/gi;

function withoutEventHandlers(content) {
  return content.replace(EVENT_HANDLER_ATTRIBUTE, '');
}

const LINK_ATTRIBUTE = /\s(?:xlink:)?href\s*=\s*("[^"]*"|'[^']*')/gi;

function isSafeLinkTarget(quotedTarget) {
  return /^["'](#|data:image\/)/i.test(quotedTarget);
}

function withoutUnsafeLinks(content) {
  return content.replace(LINK_ATTRIBUTE, (attribute, quotedTarget) => (isSafeLinkTarget(quotedTarget) ? attribute : ''));
}

const STYLE_IMPORT = /@import\b[^;]*;/gi;

function withoutStyleImports(content) {
  return content.replace(STYLE_IMPORT, '');
}

function withoutActiveContent(content) {
  return withoutStyleImports(withoutUnsafeLinks(withoutEventHandlers(withoutActiveElements(content))));
}

function innerContentOf(svgText) {
  const openingTagEnd = svgText.indexOf('>', svgText.indexOf('<svg')) + 1;
  return svgText.slice(openingTagEnd, svgText.lastIndexOf('</svg>'));
}

function millimetresToRoundedPixels(millimetres) {
  return Math.round(millimetres * PIXELS_PER_MILLIMETRE * 1e6) / 1e6;
}

function viewBoxOf(svgText) {
  const declared = readAttribute(svgText, 'viewBox');
  if (declared !== null) return declared;
  const { widthMm, heightMm } = readSvgSizeMm(svgText);
  return `0 0 ${millimetresToRoundedPixels(widthMm)} ${millimetresToRoundedPixels(heightMm)}`;
}

function centreOf(image) {
  return { x: image.xMm + image.widthMm / 2, y: image.yMm + image.heightMm / 2 };
}

export function engravedImageMarkup(image) {
  const { x, y } = centreOf(image);
  return `<g xmlns="http://www.w3.org/2000/svg" transform="rotate(180 ${x} ${y})"><svg ${prefixDeclarationsOf(image.svg)}x="${image.xMm}" y="${image.yMm}" width="${image.widthMm}" height="${image.heightMm}" viewBox="${viewBoxOf(image.svg)}" preserveAspectRatio="none">${withoutActiveContent(innerContentOf(image.svg))}</svg></g>`;
}
