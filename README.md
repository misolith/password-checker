# password-defense-core

Lightweight, multilingual password-strength analysis core extracted from sec-guide.

> ⚠️ Current maturity: **pre-release**. API can still change.

---

## What this library does

`password-defense-core` evaluates password guessability with a practical, browser-friendly model:

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
password-defense-core/
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
cd projects/password-defense-core
npm install
```

(There are no external runtime dependencies currently.)

---

## Quick start

```bash
cd projects/password-defense-core
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
cd projects/password-defense-core
npm run build:bloom
npm run debug
# open http://localhost:4173/debug/
```

The debug page lets you:
- toggle active languages (`fi`, `en`)
- test analyzer output in real time
- run quick bloom hit checks for sample words

---

## Runtime usage

```js
import { PasswordDefenseCore } from './src/index.js';
import bloom from './fixtures/blooms.generated.json' assert { type: 'json' };

const core = new PasswordDefenseCore({
  defaultLanguage: bloom.defaultLanguage,
  languages: bloom.languages,
  activeLanguages: ['fi', 'en']
});

const result = core.analyze('passwordaurinko');
console.log(result);

const hit = core.checkBloom('lintu', { languages: ['fi'] });
console.log(hit);
```

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

## NPM scripts

- `npm run build:bloom` → generate `fixtures/blooms.generated.json`
- `npm test` → run smoke test
- `npm run debug` → serve repo locally for debug page

---

## Current limitations (known)

- Not yet optimized for full morphological analysis (important for Finnish compounds/inflections)
- Scoring logic is practical, not a formal cryptographic crack-time simulator
- API may still evolve before 1.0

---

## Development policy

`sec-guide` production stability has priority.

Changes are first validated against sec-guide behavior; extraction into this core package is done incrementally to avoid regressions.

---

## License

MIT (planned for public release).
