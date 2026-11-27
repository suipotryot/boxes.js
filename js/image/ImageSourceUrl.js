export function parseImageSourceUrl(text) {
  if (text.trim() === '') throw new Error('The image URL is empty');
  return new URL(text);
}
