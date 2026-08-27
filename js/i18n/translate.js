// A missing key returns the key itself (visible, easy to spot in the UI)
// rather than throwing or returning blank — the same "fail loud but don't
// crash" spirit as ProjectRepository.load() returning null on bad data.
// A {placeholder} with no matching param is left untouched for the same
// reason, instead of silently disappearing.
export function createTranslator(dict) {
  return function t(key, params = {}) {
    const template = dict[key] ?? key;
    return template.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
  };
}
