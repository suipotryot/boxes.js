import { parseImageSourceUrl } from './ImageSourceUrl.js';

function looksLikeMarkup(text) {
  return text.startsWith('<');
}

export function readImageInput(text) {
  const trimmedText = text.trim();
  if (looksLikeMarkup(trimmedText)) return { kind: 'svg', svg: trimmedText };
  return { kind: 'url', url: parseImageSourceUrl(trimmedText) };
}
