#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const configArg = process.argv[2] || 'config/bloom.config.json';
const root = process.cwd();
const configPath = path.resolve(root, configArg);

if (!fs.existsSync(configPath)) {
  throw new Error(`Config not found: ${configPath}`);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const defaults = config.defaults || {};
const langs = config.languages || {};

function hash1FNV1a(word) {
  let h = 0x811c9dc5;
  for (let i = 0; i < word.length; i++) {
    h ^= word.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function hash2DJB2(word) {
  let h = 5381;
  for (let i = 0; i < word.length; i++) {
    h = ((h << 5) + h + word.charCodeAt(i)) >>> 0;
  }
  return h >>> 0;
}

function hashWord(word, idx, size) {
  const h1 = hash1FNV1a(word);
  let h2 = hash2DJB2(word);
  if (h2 === 0) h2 = 1;
  const mixed = (h1 + Math.imul(idx, h2) + Math.imul(idx, idx + 3)) >>> 0;
  return mixed % size;
}

function normalizeToken(token) {
  return String(token || '').normalize('NFKC').trim().toLowerCase();
}

function toPositiveInt(value, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER, name = 'value' } = {}) {
  const num = Number(value);
  if (!Number.isInteger(num) || num < min || num > max) {
    if (fallback !== undefined && fallback !== null) return fallback;
    throw new Error(`Invalid ${name}: ${value}`);
  }
  return num;
}

function expectedFpr(wordCount, size, hashes) {
  if (!wordCount || !size || !hashes) return 1;
  const expTerm = Math.exp((-hashes * wordCount) / size);
  return Math.pow(1 - expTerm, hashes);
}

function collectWarnings({ lang, size, hashes, minTokenLength, wordCount, fpr }) {
  const out = [];
  const bitsPerWord = size / Math.max(1, wordCount);

  if (hashes > 20) out.push(`[${lang}] hashes=${hashes} is high; build/read cost may be unnecessary.`);
  if (hashes < 3) out.push(`[${lang}] hashes=${hashes} is very low; false positives may increase.`);
  if (bitsPerWord < 8) out.push(`[${lang}] bits/word=${bitsPerWord.toFixed(2)} is low; consider larger size.`);
  if (fpr > 0.02) out.push(`[${lang}] estimated FPR ${(fpr * 100).toFixed(2)}% is high for security scoring.`);
  if (minTokenLength < 3) out.push(`[${lang}] minTokenLength=${minTokenLength} may over-match very short fragments.`);

  return out;
}

const output = {
  defaultLanguage: config.defaultLanguage || 'en',
  generatedAt: new Date().toISOString(),
  languages: {}
};

for (const [lang, lc] of Object.entries(langs)) {
  if (!lc.input || typeof lc.input !== 'string') {
    throw new Error(`Invalid input path for language '${lang}'`);
  }
  const size = toPositiveInt(lc.size ?? defaults.size ?? 120000, null, { min: 1024, max: 10_000_000, name: `${lang}.size` });
  const hashes = toPositiveInt(lc.hashes ?? defaults.hashes ?? 7, null, { min: 1, max: 32, name: `${lang}.hashes` });
  const minTokenLength = toPositiveInt(lc.minTokenLength ?? defaults.minTokenLength ?? 3, null, { min: 1, max: 64, name: `${lang}.minTokenLength` });

  const inputPath = path.resolve(path.dirname(configPath), '..', lc.input);
  if (!fs.existsSync(inputPath)) throw new Error(`Input missing for ${lang}: ${inputPath}`);

  const words = fs.readFileSync(inputPath, 'utf8')
    .split(/\r?\n/)
    .map(normalizeToken)
    .filter(w => w && !w.startsWith('#') && w.length >= minTokenLength);

  const uniqueWords = [...new Set(words)];
  if (!uniqueWords.length) {
    throw new Error(`No valid tokens for language '${lang}' after normalization/filtering`);
  }
  const bytes = new Uint8Array(Math.ceil(size / 8));

  for (const word of uniqueWords) {
    for (let i = 0; i < hashes; i++) {
      const h = hashWord(word, i, size);
      const byteIdx = Math.floor(h / 8);
      const bitIdx = h % 8;
      bytes[byteIdx] |= 1 << bitIdx;
    }
  }

  const fpr = expectedFpr(uniqueWords.length, size, hashes);
  output.languages[lang] = {
    size,
    hashes,
    minTokenLength,
    wordCount: uniqueWords.length,
    expectedBytes: bytes.length,
    estimatedFalsePositiveRate: Number(fpr.toFixed(8)),
    data: Buffer.from(bytes).toString('base64')
  };

  console.log(`built ${lang}: words=${uniqueWords.length}, size=${size}, hashes=${hashes}, fpr≈${(fpr * 100).toFixed(4)}%`);

  const warnings = collectWarnings({
    lang,
    size,
    hashes,
    minTokenLength,
    wordCount: uniqueWords.length,
    fpr
  });
  warnings.forEach((w) => console.warn(`⚠️  ${w}`));
}

const outPath = path.resolve(path.dirname(configPath), '..', (config.output || 'fixtures/blooms.generated.json'));
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

console.log(`✅ wrote ${outPath}`);
