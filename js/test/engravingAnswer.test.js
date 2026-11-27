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

run();
