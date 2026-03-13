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
  return token.trim().toLowerCase();
}

const output = {
  defaultLanguage: config.defaultLanguage || 'en',
  generatedAt: new Date().toISOString(),
  languages: {}
};

for (const [lang, lc] of Object.entries(langs)) {
  const size = Number(lc.size || defaults.size || 120000);
  const hashes = Number(lc.hashes || defaults.hashes || 7);
  const minTokenLength = Number(lc.minTokenLength || defaults.minTokenLength || 3);
  const inputPath = path.resolve(path.dirname(configPath), '..', lc.input);
  if (!fs.existsSync(inputPath)) throw new Error(`Input missing for ${lang}: ${inputPath}`);

  const words = fs.readFileSync(inputPath, 'utf8')
    .split(/\r?\n/)
    .map(normalizeToken)
    .filter(w => w && !w.startsWith('#') && w.length >= minTokenLength);

  const uniqueWords = [...new Set(words)];
  const bytes = new Uint8Array(Math.ceil(size / 8));

  for (const word of uniqueWords) {
    for (let i = 0; i < hashes; i++) {
      const h = hashWord(word, i, size);
      const byteIdx = Math.floor(h / 8);
      const bitIdx = h % 8;
      bytes[byteIdx] |= 1 << bitIdx;
    }
  }

  output.languages[lang] = {
    size,
    hashes,
    minTokenLength,
    wordCount: uniqueWords.length,
    data: Buffer.from(bytes).toString('base64')
  };

  console.log(`built ${lang}: words=${uniqueWords.length}, size=${size}, hashes=${hashes}`);
}

const outPath = path.resolve(path.dirname(configPath), '..', (config.output || 'fixtures/blooms.generated.json'));
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

console.log(`✅ wrote ${outPath}`);
