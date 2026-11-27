function readUrl(text) {
  try {
    return new URL(text);
  } catch {
    throw new Error(`"${text}" is not a valid URL`);
  }
}

export function parseImageSourceUrl(text) {
  if (text.trim() === '') throw new Error('The image URL is empty');
  const url = readUrl(text);
  if (url.protocol !== 'https:') throw new Error('The image URL must start with https://');
  return url;
}
