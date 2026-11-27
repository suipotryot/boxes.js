import { readEngravingAnswer } from './EngravingAnswer.js';

const ANSWER_TIMEOUT_MS = 10000;

function deliverAnswer(data, { onImage, onError }) {
  let image;
  try {
    image = readEngravingAnswer(data);
  } catch (error) {
    onError(error);
    return;
  }
  onImage(image);
}

function noAnswerError() {
  return new Error(`The image generator gave no answer within ${ANSWER_TIMEOUT_MS / 1000} seconds`);
}

export function requestEngravingImage(url, environment, callbacks) {
  const frame = environment.createFrame(url);
  const isFromFrame = (event) => event.source === frame.contentWindow;
  const stopListening = environment.listenToMessages((event) => {
    if (!isFromFrame(event)) return;
    stopWaitingForAnswer();
    deliverAnswer(event.data, callbacks);
  });
  const cancelTimer = environment.startTimer(ANSWER_TIMEOUT_MS, () => {
    stopWaitingForAnswer();
    callbacks.onError(noAnswerError());
  });

  function stopWaitingForAnswer() {
    frame.remove();
    stopListening();
    cancelTimer();
  }
}
