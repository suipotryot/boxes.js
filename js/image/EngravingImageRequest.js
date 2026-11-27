import { readEngravingAnswer } from './EngravingAnswer.js';

export function requestEngravingImage(url, environment, { onImage }) {
  let frame = null;
  environment.listenToMessages((event) => {
    if (event.source === frame.contentWindow) onImage(readEngravingAnswer(event.data));
  });
  frame = environment.createFrame(url);
}
