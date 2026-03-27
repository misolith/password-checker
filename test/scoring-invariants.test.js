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

function analyze(password) {
  return mkCore().analyze(password, { locale: 'en', languages: ['fi', 'en'] });
}

test('adding a year to a short word-based password stays costly', () => {
  const plain = analyze('stone-river');
  const withYear = analyze('stone-river-2026');

  assert.ok(withYear.riskFlags?.includes('year_pattern'));
  assert.ok(withYear.riskFlags?.includes('dictionary_pattern'));
  assert.ok(withYear.score <= plain.score + 5, `expected year-pattern variant to stay flat or only improve marginally, got ${withYear.score} vs ${plain.score}`);
  assert.notEqual(withYear.labelKey, 'good');
  assert.notEqual(withYear.labelKey, 'strong');
});

test('adding a year to a mixed longer password may still improve score overall', () => {
  const plain = analyze('MisoRiver!');
  const withYear = analyze('MisoRiver2026!');

  assert.ok(withYear.riskFlags?.includes('year_pattern'));
  assert.ok(withYear.score >= plain.score, `expected extra length to be allowed to help mixed password, got ${withYear.score} < ${plain.score}`);
});

test('adding a keyboard sequence to a word-based construction stays costly', () => {
  const plain = analyze('stone-river-stone');
  const withSequence = analyze('stone-river-123-stone');

  assert.ok(withSequence.riskFlags?.includes('sequence'));
  assert.ok(withSequence.riskFlags?.includes('dictionary_pattern'));
  assert.ok(withSequence.score >= plain.score, `expected extra length to avoid lowering score, got ${withSequence.score} < ${plain.score}`);
  assert.ok(withSequence.score <= plain.score + 5, `expected sequence variant to stay flat or only improve marginally, got ${withSequence.score} vs ${plain.score}`);
  assert.notEqual(withSequence.labelKey, 'good');
  assert.notEqual(withSequence.labelKey, 'strong');
});

test('known weak passwords remain below strong labels', () => {
  for (const password of ['password', 'Password123', 'qwerty', '123456']) {
    const result = analyze(password);
    assert.notEqual(result.labelKey, 'strong', `${password} must not be labeled strong`);
    assert.notEqual(result.labelKey, 'good', `${password} must not be labeled good`);
  }
});

test('reversed keyboard runs are flagged as sequences', () => {
  for (const password of ['poiuy', 'trewq', '987654']) {
    const result = analyze(password);
    assert.ok(result.riskFlags?.includes('sequence'), `${password} should be flagged as a sequence`);
  }
});

test('longer non-predictable variant does not score lower than shorter sibling', () => {
  const shorter = analyze('Harbor_Owl_Quartz9');
  const longer = analyze('Harbor_Owl_Quartz9!River');

  assert.ok(longer.score >= shorter.score, `expected longer variant to score >= shorter variant, got ${longer.score} < ${shorter.score}`);
});

test('predictable word-only passphrase does not outrank a random mixed password', () => {
  const phrase = analyze('correct-horse-battery-staple');
  const randomish = analyze('R9$kP2!vT7#mL4@q');

  assert.ok(phrase.riskFlags?.includes('predictable_phrase'));
  assert.ok(randomish.score >= phrase.score, `expected random mixed password to score >= predictable passphrase, got ${randomish.score} < ${phrase.score}`);
});

test('HIBP breach forces final score to zero and dangerous label', async () => {
  const core = mkCore();
  core.checkPwned = async () => ({ enabled: true, pwned: true, count: 42 });

  const result = await core.analyzeAsync('R9$kP2!vT7#mL4@q');

  assert.equal(result.score, 0);
  assert.equal(result.labelKey, 'dangerous');
  assert.ok(result.riskFlags?.includes('hibp_breached'));
  assert.equal(result.scoreBreakdown?.hibpOverride, true);
});

test('short random-looking password still carries short-length risk', () => {
  const result = analyze('xK9!qP2$');

  assert.ok(result.riskFlags?.includes('short_length'));
  assert.ok(result.score < 85, `short random-looking password should not score in the strong band, got ${result.score}`);
});

test('mixed random password still outranks its year-suffixed word-based cousin', () => {
  const predictable = analyze('correct-horse-2026');
  const randomish = analyze('R9$kP2!vT7#mL4@q');

  assert.ok(predictable.riskFlags?.includes('year_pattern'));
  assert.ok(randomish.score > predictable.score, `expected random mixed password to outrank predictable year-suffixed phrase, got ${randomish.score} <= ${predictable.score}`);
});

test('critical weak patterns collapse to zero or near-zero scores', () => {
  for (const password of ['123456', 'qwerty', 'password', 'Password123', 'Kissa2026!']) {
    const result = analyze(password);
    assert.ok(result.score <= 5, `${password} should stay in the zero-ish band, got ${result.score}`);
  }
});

test('long random mixed passwords stay in the strong 80+ band', () => {
  for (const password of ['x7$Qp2!mR9#tV4', 'vT9!mK2#rP7$zD4', 'R9$kP2!vT7#mL4@q']) {
    const result = analyze(password);
    assert.ok(result.score >= 80, `${password} should stay in the 80+ band, got ${result.score}`);
    assert.equal(result.labelKey, 'strong', `${password} should keep the strong label`);
  }
});

test('word-based year suffix does not jump into strong territory', () => {
  const result = analyze('stone-river-2026');

  assert.ok(result.riskFlags?.includes('year_pattern'));
  assert.ok(result.riskFlags?.includes('dictionary_pattern'));
  assert.ok(result.score < 20, `stone-river-2026 should remain clearly weak, got ${result.score}`);
});
