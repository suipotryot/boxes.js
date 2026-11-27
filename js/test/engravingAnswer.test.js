import { test, assert, run } from './testHarness.js';
import { readEngravingAnswer } from '../image/EngravingAnswer.js';

function thrownMessage(action) {
  try {
    action();
  } catch (error) {
    return error.message;
  }
  throw new Error('expected an error to be thrown');
}

test('readEngravingAnswer: should return the svg and its size when the generator answers with an image', () => {
  const answer = readEngravingAnswer({ type: 'engraving-image', svg: '<svg></svg>', widthMm: 60, heightMm: 20 });
  assert(answer.svg === '<svg></svg>', 'expected the svg to be kept');
  assert(answer.widthMm === 60 && answer.heightMm === 20, 'expected the size to be kept');
});

test('readEngravingAnswer: should throw naming the field and the reason when the generator refuses the request', () => {
  const message = thrownMessage(() => readEngravingAnswer({ type: 'engraving-image-error', field: 'width', reason: 'missing' }));
  assert(message.includes('width') && message.includes('missing'), `expected the field and the reason in "${message}"`);
});

test('readEngravingAnswer: should name the unengravable characters when the generator lists them', () => {
  const message = thrownMessage(() => readEngravingAnswer({ type: 'engraving-image-error', field: 'dimensions', reason: 'unengravableCharacters', characters: ['\u00f8', '\u00a7'] }));
  assert(message.includes('\u00f8') && message.includes('\u00a7'), `expected the characters in "${message}"`);
});

test('readEngravingAnswer: should throw when the message is not an engraving answer', () => {
  const message = thrownMessage(() => readEngravingAnswer({ type: 'something-else' }));
  assert(message.includes('something-else'), `expected the unknown type in "${message}"`);
});

test('readEngravingAnswer: should throw when the image has no usable size', () => {
  const message = thrownMessage(() => readEngravingAnswer({ type: 'engraving-image', svg: '<svg></svg>', widthMm: 0, heightMm: 20 }));
  assert(message.includes('size'), `expected a size error in "${message}"`);
});

test('readEngravingAnswer: should throw when the image is not svg text', () => {
  const message = thrownMessage(() => readEngravingAnswer({ type: 'engraving-image', svg: 42, widthMm: 60, heightMm: 20 }));
  assert(message.includes('svg'), `expected an svg error in "${message}"`);
});

test('readEngravingAnswer: should throw when the size is not a finite number', () => {
  for (const widthMm of [Infinity, '60', NaN]) {
    const message = thrownMessage(() => readEngravingAnswer({ type: 'engraving-image', svg: '<svg></svg>', widthMm, heightMm: 20 }));
    assert(message.includes('size'), `expected a size error for ${String(widthMm)} in "${message}"`);
  }
});

run();
