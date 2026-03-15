# Changelog

## Unreleased

## 0.1.2
- Apply baseline entropy multiplier `0.8` to reduce over-scoring of human-readable compounds
- Harden Bloom pipeline with NFKC normalization, config validation, and decoded payload size sanity checks
- Add Bloom builder warnings for risky parameter profiles (hash count, bit density, FPR, token length)
- Keep debug simulation factor controls always visible for easier tuning consistency

## 0.1.1
- Add passphrase-aware scoring so long multi-word passwords are not over-penalized as generic dictionary patterns
- Extend `analyze()` output with `strategy`, `dictionaryWordCount`, and `scoreBreakdown.bonuses.passphrase`
- Improve dictionary scanning to work on Unicode letter runs instead of only ASCII-like slices
- Add and expand regression coverage for edge cases (multi-word monotonicity, short+leetspeak, predictable phrase controls)
- Improve score transparency with `rawScore` and richer factor breakdown fields
- Refine year/short-length penalties and predictable-phrase handling for more realistic UX scoring

## 0.1.0
- Initial public prototype
- Multilingual Bloom support (fi/en)
- Optional HIBP integration (`checkPwned`, `analyzeAsync`)
- Local debug page + GitHub Pages demo
- Added typings (`src/index.d.ts`)
- Added CI test workflow
