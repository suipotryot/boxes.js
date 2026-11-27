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
  const message = thrownMessage(() => readEngravingAnswer({ type: 'engraving-image-error', field: 'dimensions', reason: 'unengravableCharacters', characters: ['ø', '§'] }));
  assert(message.includes('ø') && message.includes('§'), `expected the characters in "${message}"`);
});

test('readEngravingAnswer: should throw when the message is not an engraving answer', () => {
  const message = thrownMessage(() => readEngravingAnswer({ type: 'something-else' }));
  assert(message.includes('something-else'), `expected the unknown type in "${message}"`);
});

run();
