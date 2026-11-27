function createHiddenSandboxedFrame(url) {
  const frame = document.createElement('iframe');
  frame.hidden = true;
  frame.setAttribute('sandbox', 'allow-scripts');
  frame.src = url.href;
  document.body.appendChild(frame);
  return frame;
}

function listenToWindowMessages(handler) {
  window.addEventListener('message', handler);
  return () => window.removeEventListener('message', handler);
}

function startTimeout(delayMs, onElapsed) {
  const timerId = setTimeout(onElapsed, delayMs);
  return () => clearTimeout(timerId);
}

export const browserEngravingEnvironment = {
  createFrame: createHiddenSandboxedFrame,
  listenToMessages: listenToWindowMessages,
  startTimer: startTimeout,
};
