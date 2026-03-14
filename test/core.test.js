import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { PasswordDefenseCore } from '../src/index.js';

const bloom = JSON.parse(fs.readFileSync(new URL('../fixtures/blooms.generated.json', import.meta.url), 'utf8'));

function mkCore() {
  return new PasswordDefenseCore({
    defaultLanguage: bloom.defaultLanguage,
    locale: 'en',
    languages: bloom.languages,
    activeLanguages: ['fi', 'en']
  });
}

test('bloom checks known and unknown words', () => {
  const core = mkCore();
  assert.equal(core.checkBloom('password'), true);
  assert.equal(core.checkBloom('lintu'), true);
  assert.equal(core.checkBloom('zzzxxy'), false);
});

test('analyze is locale-pure per call', () => {
  const core = mkCore();
  const en = core.analyze('', { locale: 'en' });
  const fi = core.analyze('', { locale: 'fi' });
  assert.equal(en.label, 'Weak');
  assert.equal(fi.label, 'Heikko');
  const enAgain = core.analyze('', { locale: 'en' });
  assert.equal(enAgain.label, 'Weak');
});

test('analyze returns matched parts', () => {
  const core = mkCore();
  const r = core.analyze('passwordaurinko');
  assert.ok(Array.isArray(r.matchedParts));
  assert.ok(r.matchedParts.length >= 1);
});

test('year pattern gets penalized', () => {
  const core = mkCore();
  const r = core.analyze('Miso2026!');
  assert.ok(r.score < 60);
  assert.ok(r.tips.some((t) => /year|vuosiluku/i.test(t)));
});

test('HIBP handles non-200 as structured error', async () => {
  const core = mkCore();
  globalThis.fetch = async () => ({ ok: false, status: 503, text: async () => '' });
  core.sha1Hex = async () => 'ABCDE1234567890ABCDE1234567890ABCDE1234';
  const r = await core.checkPwned('x', { enabled: true });
  assert.equal(r.enabled, true);
  assert.equal(r.pwned, false);
  assert.equal(r.error, 'hibp_http_503');
});
