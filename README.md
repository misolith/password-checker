# password-checker

Lightweight, multilingual password-strength analysis core for browser-first password analysis.

> ⚠️ Current maturity: **pre-release**. API can still change.

---

## What this library does

`password-checker` evaluates password guessability with a practical, browser-friendly model:

1. **Entropy estimate** (length + character set diversity)
2. **Structural penalties** (common sequences, repetition)
3. **Dictionary pattern detection** via configurable **Bloom filters**

It is designed for fast client-side checks and supports multiple languages (e.g. Finnish + English).

---

## Features

- ✅ Multilingual Bloom filter support (`fi`, `en`, custom)
- ✅ Config-driven Bloom regeneration from text wordlists
- ✅ Works in browser debug flow and Node.js tests
- ✅ Adjustable Bloom parameters per language (`size`, `hashes`, `minTokenLength`)

---

## Project structure

```text
password-checker/
├─ config/
│  └─ bloom.config.json          # bloom build config
├─ wordlists/
│  ├─ en.txt                     # english source words
│  └─ fi.txt                     # finnish source words
├─ scripts/
│  └─ build-bloom.js             # regenerate bloom payloads from wordlists
├─ fixtures/
│  └─ blooms.generated.json      # generated bloom data (input for runtime)
├─ src/
│  └─ index.js                   # PasswordDefenseCore implementation
├─ debug/
│  └─ index.html                 # local debug UI
└─ test/
   └─ smoke.js                   # smoke test
```

---

## Installation (local repo usage)

```bash
cd projects/password-checker
npm install
```

(There are no external runtime dependencies currently.)

---

## Quick start

```bash
cd projects/password-checker
npm run build:bloom
npm test
```

Expected smoke output includes checks like:
- `lintu true`
- `password true`
- `random false`

---

## Local debug page

```bash
cd projects/password-checker
npm run build:bloom
npm run debug
# open http://localhost:4173/debug/
```

The debug page lets you:
- toggle active languages (`fi`, `en`)
- test analyzer output in real time
- run quick bloom hit checks for sample words
- toggle optional HIBP checks and inspect returned status/count/error

---

## How to use

### 1) In a browser HTML page

```html
<script type="module">
  import { PasswordDefenseCore } from './src/index.js';
  import bloom from './fixtures/blooms.generated.json' assert { type: 'json' };

  const checker = new PasswordDefenseCore({
    defaultLanguage: bloom.defaultLanguage,
    locale: 'en',
    languages: bloom.languages,
    activeLanguages: ['fi', 'en']
  });

  const result = checker.analyze('passwordaurinko');
  console.log(result);
</script>
```

### 2) In a Node.js project

```js
import { PasswordDefenseCore } from './src/index.js';
import fs from 'fs';

const bloom = JSON.parse(fs.readFileSync('./fixtures/blooms.generated.json', 'utf8'));

const checker = new PasswordDefenseCore({
  defaultLanguage: bloom.defaultLanguage,
  locale: 'fi',
  languages: bloom.languages,
  activeLanguages: ['fi', 'en']
});

console.log(checker.checkBloom('password'));
console.log(checker.analyze('passwordaurinko', { locale: 'fi' }));
```

### 3) Language switching at runtime

```js
checker.setLocale('fi');
checker.setActiveLanguages(['fi']);
```

### 4) Optional HaveIBeenPwned (HIBP) check

```js
const checker = new PasswordDefenseCore({
  defaultLanguage: bloom.defaultLanguage,
  locale: 'en',
  languages: bloom.languages,
  activeLanguages: ['fi', 'en'],
  hibp: { enabled: true }
});

const result = await checker.analyzeAsync('password123');
console.log(result.hibp); // { enabled: true, pwned: true/false, count }
```

HIBP uses k-anonymity: only the SHA-1 hash prefix is sent to the API.

---

## Bloom configuration

Edit `config/bloom.config.json`:

```json
{
  "defaultLanguage": "en",
  "defaults": {
    "size": 120000,
    "hashes": 7,
    "minTokenLength": 3
  },
  "languages": {
    "en": { "input": "wordlists/en.txt" },
    "fi": { "input": "wordlists/fi.txt" }
  },
  "output": "fixtures/blooms.generated.json"
}
```

### Parameter notes

- `size` (bits): larger => fewer false positives, larger payload
- `hashes`: more hashes can reduce false positives up to a point
- `minTokenLength`: ignore too-short words (helps reduce noisy matches)

---

## Included open-source wordlist example

The repository now includes:
- `wordlists/en-frequency-20k.txt`

This is a generated open-source example list (top 20k normalized English tokens) from:
- `hermitdave/FrequencyWords` (`content/2018/en/en_50k.txt`)

Use it directly in `config/bloom.config.json` if you want a stronger default English Bloom profile.

## Add a new language

1. Create a new wordlist file:
   - `wordlists/<lang>.txt`
   - one token per line
   - lowercase recommended
2. Add language entry in `config/bloom.config.json`
3. Regenerate bloom payloads:

```bash
npm run build:bloom
```

4. Enable language at runtime:

```js
core.setActiveLanguages(['fi', 'en', '<lang>']);
```

---

## Publish notes

See `PUBLISHING.md` for the release checklist (`npm version` + `npm publish --access public`).

## NPM scripts

- `npm run build:bloom` → generate `fixtures/blooms.generated.json`
- `npm test` → run smoke test
- `npm run debug` → serve repo locally for debug page

---

## Security model & limitations

This library is a **UX advisory password checker**, not a standalone security control.

Use it with server-side controls such as:
- breach/password policy enforcement
- rate limiting
- MFA / passkeys
- secure credential storage (e.g. Argon2id/bcrypt in backend)

Known limitations:
- Not yet optimized for full morphological analysis (important for Finnish compounds/inflections)
- Scoring logic is practical, not a formal cryptographic crack-time simulator
- Bloom filters may introduce probabilistic noise depending on configuration
- API may still evolve before 1.0

---

## Development policy

Stability-first development policy:

Changes should remain backward-compatible whenever possible and include runnable test/debug verification.

---

## License

MIT (planned for public release).
