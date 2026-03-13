# Publishing guide (npm)

## 1) Preconditions
- You are logged in to npm:
  - `npm whoami`
- Package name is available (or belongs to your scope):
  - `@misolith/password-checker`

## 2) Final checks
```bash
cd projects/password-defense-core
npm run build:bloom
npm test
```

## 3) Version bump
Use one of:
```bash
npm version patch
npm version minor
npm version major
```

## 4) Publish
```bash
npm publish --access public
```

## 5) Verify
- Check npm package page
- Install test in a clean project:
```bash
npm i @misolith/password-checker
```

## 6) GitHub release (recommended)
- Create a release tag matching the npm version (e.g. `v0.1.1`)
- Add short changelog notes

---

## What gets published
Controlled by `package.json -> files`:
- `src/`
- `fixtures/`
- `README.md`
- `LICENSE`

This avoids publishing debug/dev files by accident.
