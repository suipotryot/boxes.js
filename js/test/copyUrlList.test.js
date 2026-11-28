import { test, assert, run } from './testHarness.js';
import { parseCopyUrls } from '../image/CopyUrlList.js';

function messageOf(action) {
  try {
    action();
  } catch (error) {
    return error.message;
  }
  return null;
}

test('parseCopyUrls: should return no copy for an empty list', () => {
  assert(parseCopyUrls('', 2).length === 0, 'expected no copy');
});

test('parseCopyUrls: should group the lines by copy, one line per slot', () => {
  const copies = parseCopyUrls('https://a.test/1\nhttps://a.test/2\nhttps://a.test/3\nhttps://a.test/4', 2);
  const hrefs = copies.map((copy) => copy.map((url) => url.href).join(' '));
  assert(hrefs.join(' | ') === 'https://a.test/1 https://a.test/2 | https://a.test/3 https://a.test/4', `got ${hrefs}`);
});

test('parseCopyUrls: should skip blank lines', () => {
  const copies = parseCopyUrls('https://a.test/1\n\n  \nhttps://a.test/2\n', 1);
  assert(copies.length === 2, `expected 2 copies, got ${copies.length}`);
});

test('parseCopyUrls: should throw when the number of lines is not a multiple of the slot count', () => {
  const message = messageOf(() => parseCopyUrls('https://a.test/1\nhttps://a.test/2\nhttps://a.test/3', 2));
  assert(message?.includes('3') && message.includes('2'), `got ${message}`);
});

test('parseCopyUrls: should throw when URLs are given but the box has no image slot', () => {
  const message = messageOf(() => parseCopyUrls('https://a.test/1', 0));
  assert(message?.includes('no image'), `got ${message}`);
});

test('parseCopyUrls: should name the line of an invalid URL', () => {
  const message = messageOf(() => parseCopyUrls('https://a.test/1\nhttp://a.test/2', 1));
  assert(message?.startsWith('Line 2:') && message.includes('https://'), `got ${message}`);
});

run();
