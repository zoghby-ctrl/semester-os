# First-run UX and beta release preparation — October 2, 2026

The received main working tree was clean at eff1c2c. The published repository and origin/main match that commit. The independently rechecked baseline passes 123 tests in 14 files and the complete verify pipeline. Hosted main CI passed, and the current Cloudflare beta passes all 34 HTTP route/asset checks, including both legal URL forms. The earlier legal-route deployment fault is resolved.

## Onboarding navigation

Previously, fresh-user navigation controls appeared enabled and changed the hash before the setup guard redirected it back. The application now rejects unavailable app-navigation requests before changing the hash. The existing guard still handles direct workspace URLs.

Before completion, desktop/mobile workspace navigation, brand/home, Settings and related shortcuts are dimmed, expose aria-disabled and share an accessible setup explanation. Small lock icons mark workspace destinations. Setup is the active sidebar destination. Upload, demo, empty workspace, legal links, search, help and installation options remain available. The palette disables workspace commands and offers Setup; Alt+1–6 remain on the same hash.

After completion is published by the existing reactive repository, navigation unlocks immediately. Empty/demo paths enter Today; timetable generation retains its reviewed completion screen and Enter your semester action. Completion survives reload. Already-onboarded users who return to Setup retain normal navigation.

Regression tests render the real App/Provider/setup UI with fake IndexedDB. GPU/PWA services and document extraction are substituted; parsing, normalization, activation and persistence are real. jsdom is a development-only test dependency. No importer/domain/database architecture or theme rendering implementation is changed.

## Validation

The completed final pipeline passes **139 tests in 15 files**, retaining all 123 baseline tests and adding 16 UI regressions. npm test, lint, strict TypeScript, production/PWA build, both dependency audits (zero vulnerabilities), source/build security scan, repository audit and Pages artifact verification pass through npm run verify; the typecheck alias was also run directly. The repository audit covers 133 source files. The Pages artifact contains 52 allowed files, maximum 3.72 MiB, with 38 precache entries.

| Production browser check | Result |
| --- | --- |
| Setup and upload layouts | Both inspected at 1440/900/390/320; no horizontal overflow |
| Locked mouse interactions | 26 clicks; zero hash events |
| Locked keyboard activation | 50 Enter/Space activations; zero hash events |
| Workspace Alt shortcuts | 24 attempts; zero hash events |
| Command palette | Four viewport checks; disabled destinations cannot select; Setup remains available |
| Completion / reload / return to Setup | Empty, demo and actual synthetic-PDF import all unlock, enter Today and persist; configured Setup retains normal navigation |
| Theme preservation | Prism/Midnight/Campus/Focus rendered pixels change; OS reduced motion retains static identity; no overflow |
| PWA / offline | Service-worker control verified; Setup, Today, Privacy and Terms reopen offline |
| Application errors | None observed |

The browser import uses an invented one-course PDF through actual local extraction, review, normalization and activation. It does not measure arbitrary-document OCR accuracy. Disabled navigation remains focusable so keyboard and assistive-technology users can discover its description, while activation has no navigation effect. Cmdk excludes disabled destinations from selection. These targeted semantics/keyboard checks are not physical screen-reader or all-device accessibility certification.

All protected Prism, shared theme-rendering, importer, domain, database and university-adapter files compare identically with the received commit. There is no application-architecture rewrite. Development test tooling is recorded in package.json and the lockfile.

Public screenshots remain restricted to anonymous empty or authorized labelled-demo captures. The welcome capture is refreshed to show the locked state; existing image hashes preserve the reviewed privacy set. Original documents, OCR output, backups, private captures and local evidence remain excluded.

All seven public PNGs match their reviewed capture bytes and source allowlist hashes. Full-resolution visual inspection, visible-DOM checks, local OCR and PNG metadata checks found no personal names, IDs, emails, account details, local paths or private material. The six demo/policy captures remain unchanged; only the anonymous welcome image is replaced.

## Files in this continuation

- Navigation/setup: src/App.tsx, src/lib/context.tsx, src/pages/Welcome.tsx, src/styles.css and new src/onboarding.test.tsx.
- Test tooling: package.json and package-lock.json (development-only jsdom).
- Public reporting: .github/ISSUE_TEMPLATE/config.yml and new bug_report.yml/beta_feedback.yml. The existing CI workflow is reviewed and unchanged.
- Screenshot gate: scripts/repository-files.mjs, docs/screenshots/welcome-desktop.png and docs/screenshots/README.md.
- Documentation: README.md, CONTRIBUTING.md, SECURITY.md, VALIDATION.md, docs/DEPLOYMENT.md, FINAL_RELEASE_REVIEW.md, MOTION_MILESTONE.md, MOTION_DEPLOYMENT_REVIEW.md, RELEASE_READINESS.md, REPOSITORY_REVIEW.md, AUDIT.md and SECURITY_REPORT.md; this review and new docs/releases/v0.1.0-beta.1.md.

## GitHub beta review

- README, CONTRIBUTING, SECURITY and current release/deployment reviews reflect public source and the working hosted deployment. Historical milestone documents explicitly identify their earlier observations.
- No source license is selected. Source availability does not imply permission to reuse, modify or redistribute; no license or legal guarantee is added.
- The existing workflow uses Node 24, pinned actions, read-only permissions, complete checks and a short-lived build artifact. Main's published baseline workflow passed; the new local commit needs its own run after push. Dependabot proposals are not merged as part of this task.
- Public bug/feedback forms request synthetic examples and explicitly exclude personal data and sensitive vulnerability reports.
- Private vulnerability reporting is verified disabled. No monitored project contact is configured. The owner should enable a private reporting channel before the tagged beta; see [SECURITY.md](../SECURITY.md). The maintainer command is:

```sh
gh api --method PUT repos/zoghby-ctrl/semester-os/private-vulnerability-reporting
```

Recommended repository topics: local-first, offline-first, pwa, academic-planner, timetable, student-tools, react, typescript and indexeddb. These are recommendations; repository topics are not changed. Avoid advertising the project as open source while its license remains undecided.

[v0.1.0-beta.1 release notes](releases/v0.1.0-beta.1.md) are drafted. No tag or release is created. The private npm package version is unchanged; a future beta tag describes release status and does not publish an npm package.

## Publish and deploy this fix

After the reviewed local commit:

```sh
git push origin main
npx --yes wrangler@4.146.0 pages deploy dist --project-name=semester-os --branch=main
npm run verify:hosted -- https://semester-os-4y6.pages.dev
```

This task does not push, deploy or create a release. Before v0.1.0-beta.1, publish/deploy the fix and verify its own hosted CI/browser behavior, obtain explicit release authorization, establish private vulnerability reporting, and resolve or explicitly record the undecided license, operator/contact, draft-policy and physical-device/student beta limitations. The optional semesteros.is-a.dev alias remains pending its PR and custom-domain setup.
