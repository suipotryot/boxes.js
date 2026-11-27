function listedCharacters({ characters }) {
  return characters ? ` [${characters.join(' ')}]` : '';
}

function refusalMessage(answer) {
  return `The image generator refused the request (${answer.field}: ${answer.reason}${listedCharacters(answer)})`;
}

function assertHasUsableSize({ widthMm, heightMm }) {
  if (!(widthMm > 0 && heightMm > 0)) throw new Error(`The image generator gave an unusable size: ${widthMm} x ${heightMm} mm`);
}

export function readEngravingAnswer(answer) {
  if (answer.type === 'engraving-image-error') throw new Error(refusalMessage(answer));
  if (answer.type !== 'engraving-image') throw new Error(`Unexpected answer from the image generator: "${answer.type}"`);
  assertHasUsableSize(answer);
  const { svg, widthMm, heightMm } = answer;
  return { svg, widthMm, heightMm };
}
