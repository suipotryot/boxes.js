export function parseImageSourceUrl(text) {
  if (text.trim() === '') throw new Error('The image URL is empty');
  const url = new URL(text);
  if (url.protocol !== 'https:') throw new Error('The image URL must start with https://');
  return url;
}
