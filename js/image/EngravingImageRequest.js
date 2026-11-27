import { readEngravingAnswer } from './EngravingAnswer.js';

const ANSWER_TIMEOUT_MS = 10000;

export function requestEngravingImage(url, environment, { onImage }) {
  const frame = environment.createFrame(url);
  const stopListening = environment.listenToMessages((event) => {
    if (event.source !== frame.contentWindow) return;
    finish();
    onImage(readEngravingAnswer(event.data));
  });
  const cancelTimer = environment.startTimer(ANSWER_TIMEOUT_MS, () => {});

  function finish() {
    frame.remove();
    stopListening();
    cancelTimer();
  }
}
