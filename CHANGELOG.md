# Changelog

## Unreleased

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
