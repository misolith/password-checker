# Changelog

## Unreleased
- Add passphrase-aware scoring so long multi-word passwords are not over-penalized as generic dictionary patterns
- Extend `analyze()` output with `strategy`, `dictionaryWordCount`, and `scoreBreakdown.bonuses.passphrase`
- Improve dictionary scanning to work on Unicode letter runs instead of only ASCII-like slices
- Add passphrase regression coverage for long separator-based passwords vs short word compounds

## 0.1.0
- Initial public prototype
- Multilingual Bloom support (fi/en)
- Optional HIBP integration (`checkPwned`, `analyzeAsync`)
- Local debug page + GitHub Pages demo
- Added typings (`src/index.d.ts`)
- Added CI test workflow
