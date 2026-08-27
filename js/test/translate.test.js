import { test, assert, run } from './testHarness.js';
import { createTranslator } from '../i18n/translate.js';

test('t() returns the dictionary entry for a known key', () => {
  const t = createTranslator({ 'app.title': 'Boxes.js' });
  assert(t('app.title') === 'Boxes.js');
});

test('t() returns the key itself when the dictionary has no entry for it', () => {
  const t = createTranslator({});
  assert(t('missing.key') === 'missing.key', 'a missing key should be visible, not silently blank');
});

test('t() interpolates {placeholder} tokens from the params object', () => {
  const t = createTranslator({ 'drawer.play': 'Play: {mm} mm' });
  assert(t('drawer.play', { mm: 3 }) === 'Play: 3 mm');
});

test('t() leaves a {placeholder} token untouched when no matching param is given', () => {
  const t = createTranslator({ 'drawer.play': 'Play: {mm} mm' });
  assert(t('drawer.play') === 'Play: {mm} mm', 'a missing param should stay visible for debugging, not vanish');
});

test('t() replaces every occurrence of a repeated placeholder', () => {
  const t = createTranslator({ greet: '{name}, hello {name}' });
  assert(t('greet', { name: 'Gus' }) === 'Gus, hello Gus');
});

run();
