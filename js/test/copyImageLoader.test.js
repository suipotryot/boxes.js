import { test, assert, run } from './testHarness.js';
import { loadCopyImages } from '../image/CopyImageLoader.js';

const urlOf = (path) => new URL(`https://a.test/${path}`);
const answerFor = (url) => ({ svg: `<svg id="${url.pathname}"/>`, widthMm: 10, heightMm: 10 });

async function messageOfRejection(promise) {
  try {
    await promise;
  } catch (error) {
    return error.message;
  }
  return null;
}

test('loadCopyImages: should give the answers grouped like the URLs', async () => {
  const loadImage = async (url) => answerFor(url);
  const answers = await loadCopyImages([[urlOf('1'), urlOf('2')], [urlOf('3'), urlOf('4')]], loadImage);
  const ids = answers.map((copy) => copy.map((answer) => answer.svg).join(''));
  assert(ids.join('|') === '<svg id="/1"/><svg id="/2"/>|<svg id="/3"/><svg id="/4"/>', `got ${ids}`);
});

test('loadCopyImages: should load one image at a time', async () => {
  let running = 0;
  let maxRunning = 0;
  const loadImage = async (url) => {
    running += 1;
    maxRunning = Math.max(maxRunning, running);
    await Promise.resolve();
    running -= 1;
    return answerFor(url);
  };
  await loadCopyImages([[urlOf('1'), urlOf('2')], [urlOf('3')]], loadImage);
  assert(maxRunning === 1, `expected one request at a time, got ${maxRunning}`);
});

test('loadCopyImages: should stop at the first failure and name the copy and the image', async () => {
  const requested = [];
  const loadImage = async (url) => {
    requested.push(url.pathname);
    if (url.pathname === '/3') throw new Error('no answer');
    return answerFor(url);
  };
  const message = await messageOfRejection(loadCopyImages([[urlOf('1'), urlOf('2')], [urlOf('3'), urlOf('4')]], loadImage));
  assert(message === 'Copy 2, image 1 (https://a.test/3): no answer', `got ${message}`);
  assert(!requested.includes('/4'), 'expected the loading to stop at the failure');
});

run();
