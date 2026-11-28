import { parseImageSourceUrl } from './ImageSourceUrl.js';

function nonBlankLines(text) {
  return text.split('\n').map((line, index) => ({ lineNumber: index + 1, text: line.trim() })).filter((line) => line.text !== '');
}

function parseLine(line) {
  try {
    return parseImageSourceUrl(line.text);
  } catch (error) {
    throw new Error(`Line ${line.lineNumber}: ${error.message}`, { cause: error });
  }
}

function assertLinesFitSlots(lineCount, slotCount) {
  if (lineCount === 0) return;
  if (slotCount === 0) throw new Error('The box has no image to replace: add an image to a piece first');
  if (lineCount % slotCount !== 0) {
    throw new Error(`${lineCount} URLs cannot be shared between copies of ${slotCount} images each`);
  }
}

function splitEvery(items, size) {
  return Array.from({ length: items.length / size }, (_, copyIndex) => items.slice(copyIndex * size, (copyIndex + 1) * size));
}

export function parseCopyUrls(text, slotCount) {
  const lines = nonBlankLines(text);
  assertLinesFitSlots(lines.length, slotCount);
  return lines.length === 0 ? [] : splitEvery(lines.map(parseLine), slotCount);
}
