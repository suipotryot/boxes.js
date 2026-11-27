import { readEngravingAnswer } from './EngravingAnswer.js';

const ANSWER_TIMEOUT_MS = 10000;

function answerOrError(data) {
  try {
    return { image: readEngravingAnswer(data) };
  } catch (error) {
    return { error };
  }
}

export function requestEngravingImage(url, environment, { onImage, onError }) {
  const frame = environment.createFrame(url);
  const stopListening = environment.listenToMessages((event) => {
    if (event.source !== frame.contentWindow) return;
    finish();
    const { image, error } = answerOrError(event.data);
    if (error) onError(error);
    else onImage(image);
  });
  const cancelTimer = environment.startTimer(ANSWER_TIMEOUT_MS, () => {});

  function finish() {
    frame.remove();
    stopListening();
    cancelTimer();
  }
}
