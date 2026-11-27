function refusalMessage({ field, reason }) {
  return `The image generator refused the request (${field}: ${reason})`;
}

export function readEngravingAnswer(answer) {
  if (answer.type === 'engraving-image-error') throw new Error(refusalMessage(answer));
  const { svg, widthMm, heightMm } = answer;
  return { svg, widthMm, heightMm };
}
