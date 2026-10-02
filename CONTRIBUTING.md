# Contributing to Semester OS

Use Node 24, or Node 22.13+ with a compatible npm version. Run `npm ci`, `npm run prepare:import-assets`, then `npm run dev`. The app is served on `http://127.0.0.1:5173`. A clean browser starts without courses or a personal profile. Use the labelled Demo Semester or synthetic test data.

## Protect existing work

Read [architecture](docs/ARCHITECTURE.md), [decisions](docs/DECISIONS.md), and [the migration audit](docs/AUDIT.md). Keep the database name and existing stable IDs. Do not re-seed new students with the legacy fixture or drop data to make a migration pass. Destructive replacement needs validation, a reviewable confirmation, and a recovery snapshot.

Treat imports, notes, identifiers, and browser storage as untrusted runtime data. Use repository functions rather than writing component state directly to IndexedDB. Render text through React; do not add executable HTML, URL-controlled styles, or arbitrary imported links. Add meaningful tests for trust boundaries and domain changes.

Prism's renderer, star drift, and instanced meteor pool are the visual baseline. New themes should use shared definitions, primitives, and the scene dispatcher. Respect both reduced-motion settings, visibility, mobile budgets, and keyboard/touch access. No React state changes in frame loops.

## Validation and pull requests

Run `npm run verify`. Check relevant desktop and 390px/320px mobile layouts using a production build from `node serve.mjs`. For renderer, importer, or PWA changes, repeat reduced motion, the intended CSP, and offline controlled reload checks. Describe what changed, why, what was actually tested, and what remains unverified. CI must pass; do not delete tests to obtain a passing suite.

Never commit personal academic documents, source screenshots, backup files, credentials, or `.env` files. `sources/`, `output/`, `tmp/`, original screenshots, generated extraction assets, and local env files are ignored. Recreate vendor assets from the lockfile with the preparation script. Review the actual Git staging list before publication; ignore rules do not remove already tracked files.

Security reports belong in a private channel described in [SECURITY.md](SECURITY.md), not a public issue. External services and off-device processing require an explicit product/privacy decision. There is no cloud service to configure for V1.

## License decision

The repository is public, but no source-code license has been selected. Source availability does not imply permission to reuse, modify or redistribute the code. Do not add a license or assume contribution/reuse terms without the owner's decision; discuss proposed contributions with the maintainer. Preserve third-party notices. Publication is not a legal guarantee.
