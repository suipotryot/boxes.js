function listedCharacters({ characters }) {
  return characters ? ` [${characters.join(' ')}]` : '';
}

function refusalMessage(answer) {
  return `The image generator refused the request (${answer.field}: ${answer.reason}${listedCharacters(answer)})`;
}

function hasUsableSize({ widthMm, heightMm }) {
  return [widthMm, heightMm].every((lengthMm) => Number.isFinite(lengthMm) && lengthMm > 0);
}

function assertHasUsableSize(answer) {
  if (!hasUsableSize(answer)) throw new Error(`The image generator gave an unusable size: ${answer.widthMm} x ${answer.heightMm} mm`);
}

function assertIsSvgText({ svg }) {
  if (typeof svg !== 'string' || !/<svg[\s>]/.test(svg)) throw new Error('The image generator did not send svg text');
}

export function readEngravingAnswer(answer) {
  if (answer.type === 'engraving-image-error') throw new Error(refusalMessage(answer));
  if (answer.type !== 'engraving-image') throw new Error(`Unexpected answer from the image generator: "${answer.type}"`);
  assertIsSvgText(answer);
  assertHasUsableSize(answer);
  const { svg, widthMm, heightMm } = answer;
  return { svg, widthMm, heightMm };
}
