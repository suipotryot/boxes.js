import { test, assert, run } from './testHarness.js';
import { requestEngravingImage } from '../image/EngravingImageRequest.js';

const LABEL_URL = new URL('https://example.com/labels/?mode=image&width=60&height=20&hardwareType=screw');
const LABEL_ANSWER = { type: 'engraving-image', svg: '<svg></svg>', widthMm: 60, heightMm: 20 };

function fakeEnvironment() {
  const environment = {
    frame: { contentWindow: { name: 'label frame' }, isRemoved: false, remove() { this.isRemoved = true; } },
    isListening: false,
    timer: null,
    createFrame(url) {
      environment.frameUrl = url.href;
      return environment.frame;
    },
    listenToMessages(handler) {
      environment.isListening = true;
      environment.deliver = handler;
      return () => { environment.isListening = false; };
    },
    startTimer(delayMs, onElapsed) {
      environment.timer = { delayMs, onElapsed, isCancelled: false };
      return () => { environment.timer.isCancelled = true; };
    },
    answerFromFrame(data) {
      environment.deliver({ source: environment.frame.contentWindow, data });
    },
  };
  return environment;
}

function recordingCallbacks() {
  const calls = { images: [], errors: [] };
  return { calls, onImage: (image) => calls.images.push(image), onError: (error) => calls.errors.push(error) };
}

test('requestEngravingImage: should give the image sent by the frame it created', () => {
  const environment = fakeEnvironment();
  const { calls, onImage, onError } = recordingCallbacks();
  requestEngravingImage(LABEL_URL, environment, { onImage, onError });
  environment.answerFromFrame(LABEL_ANSWER);
  assert(environment.frameUrl === LABEL_URL.href, 'expected the frame to load the URL');
  assert(calls.images.length === 1 && calls.images[0].svg === '<svg></svg>', 'expected the image to be given');
});

test('requestEngravingImage: should ignore a message that does not come from its frame', () => {
  const environment = fakeEnvironment();
  const { calls, onImage, onError } = recordingCallbacks();
  requestEngravingImage(LABEL_URL, environment, { onImage, onError });
  environment.deliver({ source: { name: 'another window' }, data: LABEL_ANSWER });
  assert(calls.images.length === 0 && calls.errors.length === 0, 'expected the foreign message to be ignored');
});

test('requestEngravingImage: should remove its frame, stop listening and cancel the timer once the image is given', () => {
  const environment = fakeEnvironment();
  const { onImage, onError } = recordingCallbacks();
  requestEngravingImage(LABEL_URL, environment, { onImage, onError });
  environment.answerFromFrame(LABEL_ANSWER);
  assert(environment.frame.isRemoved, 'expected the frame to be removed');
  assert(!environment.isListening, 'expected the listener to be stopped');
  assert(environment.timer.isCancelled, 'expected the timer to be cancelled');
});

test('requestEngravingImage: should report the refusal of the generator and clean up', () => {
  const environment = fakeEnvironment();
  const { calls, onImage, onError } = recordingCallbacks();
  requestEngravingImage(LABEL_URL, environment, { onImage, onError });
  environment.answerFromFrame({ type: 'engraving-image-error', field: 'width', reason: 'missing' });
  assert(calls.errors.length === 1 && calls.errors[0].message.includes('width'), 'expected the refusal to be reported');
  assert(environment.frame.isRemoved, 'expected the frame to be removed');
});

test('requestEngravingImage: should report an error and remove its frame when nobody answers within ten seconds', () => {
  const environment = fakeEnvironment();
  const { calls, onImage, onError } = recordingCallbacks();
  requestEngravingImage(LABEL_URL, environment, { onImage, onError });
  assert(environment.timer.delayMs === 10000, 'expected a ten seconds timer');
  environment.timer.onElapsed();
  assert(calls.errors.length === 1 && calls.errors[0].message.includes('no answer'), 'expected a no-answer error');
  assert(environment.frame.isRemoved && !environment.isListening, 'expected the frame to be removed and the listener stopped');
});

run();
