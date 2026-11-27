import { test, assert, run } from './testHarness.js';
import { parseImageSourceUrl } from '../image/ImageSourceUrl.js';

function thrownMessage(action) {
  try {
    action();
  } catch (error) {
    return error.message;
  }
  throw new Error('expected an error to be thrown');
}

test('parseImageSourceUrl: should return the URL when the text is a valid https address', () => {
  const url = parseImageSourceUrl('https://suipotryot.github.io/laser-labels/?mode=image&width=60');
  assert(url.hostname === 'suipotryot.github.io', 'expected the hostname to be read');
  assert(url.searchParams.get('width') === '60', 'expected the query to be kept');
});

test('parseImageSourceUrl: should throw an explicit error when the text is empty', () => {
  assert(thrownMessage(() => parseImageSourceUrl('   ')).includes('empty'), 'expected an error saying the URL is empty');
});

test('parseImageSourceUrl: should reject an address that is not https', () => {
  assert(thrownMessage(() => parseImageSourceUrl('http://example.com/label')).includes('https'), 'expected an error mentioning https');
});

test('parseImageSourceUrl: should reject a text that is not an address', () => {
  assert(thrownMessage(() => parseImageSourceUrl('not an address')).includes('not a valid'), 'expected an error saying the address is not valid');
});

test('parseImageSourceUrl: should accept a plain http address on localhost for development', () => {
  assert(parseImageSourceUrl('http://localhost:5173/?mode=image').port === '5173', 'expected the localhost address to be accepted');
});

run();
