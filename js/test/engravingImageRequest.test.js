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

run();
