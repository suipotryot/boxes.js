import { test, assert, run } from './testHarness.js';
import { readImageInput } from '../image/ImageInput.js';

function thrownMessage(action) {
  try {
    action();
  } catch (error) {
    return error.message;
  }
  throw new Error('expected an error to be thrown');
}

test('readImageInput: should recognise pasted SVG code', () => {
  const input = readImageInput('  <svg width="10mm" height="5mm"></svg>  ');
  assert(input.kind === 'svg' && input.svg === '<svg width="10mm" height="5mm"></svg>', `got ${JSON.stringify(input)}`);
});

test('readImageInput: should recognise an SVG file that starts with an XML declaration', () => {
  assert(readImageInput('<?xml version="1.0"?>\n<svg></svg>').kind === 'svg', 'expected an svg');
});

test('readImageInput: should recognise an address and give it as a URL', () => {
  const input = readImageInput('https://example.com/label?mode=image');
  assert(input.kind === 'url' && input.url.hostname === 'example.com', `got ${JSON.stringify(input)}`);
});

test('readImageInput: should throw when the text is empty', () => {
  assert(thrownMessage(() => readImageInput('  ')).includes('empty'), 'expected an error saying the text is empty');
});

test('readImageInput: should explain the address problem when the text looks like an address', () => {
  assert(thrownMessage(() => readImageInput('http://example.com/label')).includes('https'), 'expected an error mentioning https');
});

run();
