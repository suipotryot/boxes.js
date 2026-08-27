import { test, assert, run } from './testHarness.js';
import { setActiveLocale, getActiveLocale, t } from '../i18n/index.js';
import { fr } from '../i18n/fr.js';
import { en } from '../i18n/en.js';

test('getActiveLocale() defaults to "fr" before setActiveLocale() is ever called', () => {
  assert(getActiveLocale() === 'fr');
});

test('t() resolves against the default "fr" dictionary', () => {
  assert(t('shared.machineTitle') === 'Ma machine');
});

test('setActiveLocale("en") switches both getActiveLocale() and t()', () => {
  setActiveLocale('en');
  assert(getActiveLocale() === 'en');
  assert(t('shared.machineTitle') === 'My machine');
  setActiveLocale('fr'); // leave the module-level singleton as found, for later tests in this same process
});

test('setActiveLocale() falls back to "fr" for an unknown locale', () => {
  setActiveLocale('de');
  assert(getActiveLocale() === 'fr');
});

test('fr.js and en.js define exactly the same set of keys', () => {
  const frKeys = new Set(Object.keys(fr));
  const enKeys = new Set(Object.keys(en));
  const missingFromEn = [...frKeys].filter((k) => !enKeys.has(k));
  const missingFromFr = [...enKeys].filter((k) => !frKeys.has(k));
  assert(missingFromEn.length === 0, `en.js is missing: ${missingFromEn.join(', ')}`);
  assert(missingFromFr.length === 0, `fr.js is missing: ${missingFromFr.join(', ')}`);
});

run();
