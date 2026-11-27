function listedCharacters({ characters }) {
  return characters ? ` [${characters.join(' ')}]` : '';
}

function refusalMessage(answer) {
  return `The image generator refused the request (${answer.field}: ${answer.reason}${listedCharacters(answer)})`;
}

export function readEngravingAnswer(answer) {
  if (answer.type === 'engraving-image-error') throw new Error(refusalMessage(answer));
  if (answer.type !== 'engraving-image') throw new Error(`Unexpected answer from the image generator: "${answer.type}"`);
  const { svg, widthMm, heightMm } = answer;
  return { svg, widthMm, heightMm };
}
