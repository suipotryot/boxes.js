import { test, assert, run } from './testHarness.js';
import { parseImageSourceUrl } from '../image/ImageSourceUrl.js';

test('parseImageSourceUrl: should return the URL when the text is a valid https address', () => {
  const url = parseImageSourceUrl('https://suipotryot.github.io/laser-labels/?mode=image&width=60');
  assert(url.hostname === 'suipotryot.github.io', 'expected the hostname to be read');
  assert(url.searchParams.get('width') === '60', 'expected the query to be kept');
});

run();
