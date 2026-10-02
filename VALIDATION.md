# Validation — October 2, 2026

## Product generalization — current local continuation

The clean current baseline at `7017edb` was verified before editing: **194 tests in 20 files** and the complete verification pipeline passed. The university-first continuation retains every baseline test and adds **71 regressions**, for **265 passing tests in 21 files**. The full assumption audit, implementation, exact changed-file list, validation matrix, and remaining limits are in [the product-generalization report](docs/PRODUCT_GENERALIZATION.md).

Lint, the explicit `npm run typecheck`, production/PWA build, both dependency audits with zero vulnerabilities, security scan, repository audit (149 files), Pages artifact checks (52 files), and the final complete `npm run verify` all passed. Exact results are recorded in the linked report. No dependency, backend, account, remote OCR, AI API, cloud storage, or telemetry was added. Schema versions and historical workspace interpretation remain unchanged; academic context evidence is optional additive data.

**50 production Chromium scenarios passed** using isolated synthetic fixtures. All requested widths—1440, 900, 390, and 320—cover neutral fresh setup, generic/custom universities, ECU Level 1 and Level 2, another ECU level, unknown context, timetable-only and timetable/plan imports, explicit wrong-page keep/use decisions, automatic page suggestions, manual entry, existing ECU workspace restoration, and offline reopen. Context confirmation remains explicit. There were no application exceptions or horizontal overflow. Manual mobile review exposed an overlapping source panel; scoped positioning now passes actual pointer interaction at all four widths.

Two additional scenarios in that 50-scenario total exercise actual local English OCR of timetable/plan images, including a cropped table's academic heading strip. They preserve code-first enrichment, leave detected level/term unconfirmed, and make zero remote requests. Existing owner-format v2 backups preserve all six courses, eleven sessions, attendance, notes, planner items, topics, study history, recovery, and exact settings across restore and controlled offline reload. Midnight, Campus, Focus, and Prism are included; protected theme/rendering files are unchanged.

The actual owner's private documents/backup were not attached to this continuation. Compatibility used the existing schema and retained historical fixtures; synthetic OCR success does not establish every real document's accuracy. No commit, push, deployment, tag, or release was performed. The implementation awaits owner review.

## Earlier first-run navigation continuation

The published main baseline at eff1c2c was rechecked from a clean working tree: 123 tests in 14 files and the complete verify pipeline pass. The public GitHub repository is verified, main's hosted CI passed, and the live beta passes all 34 HTTP route/asset checks. The earlier legal-route deployment fault is resolved. Private vulnerability reporting is verified disabled. No source license is selected.

This continuation adds 16 real App/Provider/setup/persistence regressions: **139 tests pass across 15 files**. Lint, direct strict typecheck, production/PWA build, both dependency audits (zero vulnerabilities), security scan, repository audit (133 reviewed source files) and the complete verify pipeline pass.

Setup and upload were inspected at 1440/900/390/320 with no horizontal overflow. Production browser checks cover 26 locked clicks, 50 Enter/Space activations and 24 Alt shortcuts with zero hash events; four palette checks; all three completion paths and persistence; actual synthetic-PDF extraction/review/activation; configured users returning to Setup; four protected themes with motion/reduced motion; and four controlled offline routes. No application errors were observed. Browser accessibility-tree/description checks are targeted checks, not physical assistive-technology certification.

All seven public screenshots pass renewed local OCR/metadata review and match their reviewed image hashes. The welcome image is refreshed; the other six are unchanged. Protected Prism, shared renderers, importer/domain/database and adapter files compare identically with the received commit. Final evidence and the full changed-file list are recorded in [beta release preparation](docs/BETA_RELEASE_PREPARATION.md). The new UI fix still needs pushing and redeployment; no tag/release is created.

## Earlier final theme polish

The current-state baseline was independently verified before editing: **118 tests in 13 files**, lint, strict TypeScript, production/PWA build, both dependency audits with zero vulnerabilities, source/build security scan, repository privacy scan and Pages artifact checks. The final suite contains **123 passing tests in 14 files**, retaining every baseline test and adding two atmosphere regressions plus three deployment-routing regressions. See [the final release review](docs/FINAL_RELEASE_REVIEW.md) for the full current evidence and boundaries.

Only Midnight, Campus and Focus were visually changed. All 13 curated themes were audited in the actual browser at desktop/mobile widths. Prism shaders, renderer, CSS, star/meteor modules remain byte-for-byte identical. Academic/importer/storage/legacy conversion code is unchanged.

Seven public screenshots are replaced with production captures from isolated empty or anonymous labelled-demo profiles, with blank display names. Full-resolution visual review, visible-text checks, local OCR and exact SHA-256 gates protect the public set. Names, student IDs, emails, account details, local Windows paths and private source/backup material are excluded.

The earlier read-only verification found a public legal-route 308→404 fault. The canonical-root proxy fix passed **34 HTTP route/asset checks in the local Pages runtime** and has since been deployed: the current hosted beta also passes all 34 checks. The optional semesteros.is-a.dev alias remains pending; no production claim is made for it.

## Earlier October 1 local-beta evidence

This records the earlier 93-test local-beta milestone, after the verified 72-test migration baseline. Subsequent theme-motion and Cloudflare preparation results are in [the motion milestone report](docs/MOTION_MILESTONE.md). It supersedes the older personal-workspace validation notes. Verification used Node 24.18.0 on Windows and isolated Chromium browser profiles against the local production server with the intended security headers. The original Prism rendering modules and meteor engine were preserved.

## Repeatable build checks

`npm ci` completed from the lockfile. `npm run verify` runs ESLint, strict TypeScript, all tests, the production build, separate production/full dependency audits, and the source/build security scan.

- **93 tests pass in 10 files**. Existing scheduling, persistence, migration, adapter, importer, product, Prism, and meteor tests remain. New theme and hostile-input tests cover actual calculations, validation, and repository transactions.
- ESLint and strict TypeScript pass.
- Production build passes, with 39 precache entries and approximately **2.56 MiB** of uncompressed app-shell assets. PDF/OCR tools are separately prepared, approximately 24 MB.
- Both dependency audit scopes report **zero known vulnerabilities** at verification time. The installer emits a transitive `glob` deprecation warning; a clean advisory result is not a supply-chain guarantee.
- The final combined run reached the audit stage after all code/build checks passed; npm's advisory endpoint transiently failed. Retrying `security:audit` succeeded in both scopes, and the final security scan passed.
- The redacted source/config/env/public/build scan reports no matching secrets or unsafe application DOM/evaluation APIs. Production source maps are disabled. There is no Git history in this supplied directory to inspect.
- CI is configured for Node 24, the same gates, pinned GitHub Actions revisions, read-only repository permissions, and a build artifact. Hosted CI has not run because this directory is not a Git checkout or a published repository.

## New-student and academic flows

- A fresh browser starts with an empty academic workspace and visible privacy/Terms links. No account, email, password, developer timetable, or required privacy checkbox is requested.
- Choose ECU, enter academic context, select the supplied timetable PDF and optional material plan, and run actual local extraction under CSP. The timetable produces **6 courses and 11 distinct sessions**. OCR/table-derived mistakes and uncertain values remain reviewable; source documents remain alongside the editable fields. All 6 course and 11 session confirmations are required before activation.
- A corrected reviewed semester opens Today. Schedule, Courses, course workspaces, Progress, Planner, and grouped Settings consume the normalized semester and stable IDs.
- Actual image OCR also recognizes 6 courses/11 sessions with the network disabled after tool preparation. The review screen was checked at 320, 390, and 1440 pixels. Source images/PDFs and private import screenshots are excluded from public documentation.
- The generic university/manual path produces one course and two overlapping Wednesday lectures. Both schedule entries remain individually selectable. Missing credits and rooms appear as **Not supplied**, and the course/semester survive reload. Optional metadata is not invented.
- **Explore Demo Semester** and **Open an empty workspace** both reach Today with one click from a fresh start. Demo data is explicitly labelled and persists across reload. The first-run database/navigation race found during QA was corrected.
- Attendance arrival at 08:51 for a reviewed 08:40 start gives **11 late minutes** and updates the course/Progress. Course notes, a completed topic, a planner item, and study history persist. A running timer advances, pauses, survives reload, and saves to history.
- Complete workspace deletion is disabled until `DELETE` is entered. It clears all academic tables, wallpaper, timer, appearance, preferences, and recovery copies, then returns to clean onboarding. Record reset has its separate `RESET` confirmation and retains the semester/preferences with a recovery point.

These are browser walkthroughs with developer automation and supplied fixtures, not an unassisted external-student usability study or a guarantee of arbitrary university/OCR accuracy.

## Appearance, motion, and keyboard checks

- All **13 curated themes plus Custom** were applied through the real UI at desktop and compact widths. The miniature dashboard uses the selected actual renderer, tokens, surfaces, typography, particles, and effects. Apply/undo, curated favorites/filter, customized saved looks, and reload persistence were exercised.
- Custom animation/particle choices and mid-tone background `#888888` were checked. Keyboard control of card opacity saves/restores the final value. Theme tests verify protected text/accent contrast on reading surfaces across hostile palette combinations and mobile/preview particle budgets.
- All 14 selections respect emulated OS Reduce Motion. Manual Reduce Motion was exercised on Prism, Aurora, Neon Grid, and Pastel Nebula. Their identities remain visible while movement stops.
- Browser WebGL draw calls and canvas clear calls were instrumented for representative scenes. Moving scenes draw; settled reduced-motion and simulated hidden states stop additional draws; restoring visibility resumes. Instrumentation was removed afterward. Visibility was simulated; physical battery/GPU consumption and native background-tab behavior were not measured.
- Ctrl+K search, Enter course selection, dialog focus containment, Escape dismissal, and a keyboard slider were exercised. This is targeted keyboard/contrast verification, not a full assistive-technology or accessibility certification.
- The six-item mobile navigation includes Planner. Settings tabs scroll horizontally. Touch layouts were visually inspected using the published demo captures.

## Desktop/mobile layout and hostile text

The final route matrix asserts each expected page heading, active Settings tab where applicable, and fully settled page opacity. **44 route/viewport checks pass at widths 320, 390, 900, and 1440 pixels**, covering Today, Schedule, Courses, a course workspace, Progress, Planner, and all five Settings groups.

Literal script/HTML/URL-looking strings and Unicode were entered in notes and Planner and restored in course/room values from a validated hostile-text backup. They remained text: no injected image/script elements or payload execution appeared. The same matrix passed with those strings. Long room text and narrow review fields exposed overflow; their wrapping/grid constraints were corrected. Rapid hash navigation exposed a transition wait that could leave old content visible; route content now publishes immediately with a short entry fade.

Public `/privacy` and `/terms` routes were checked before onboarding, with corrupted local storage, and offline, including 320/390/1440-pixel layout and correct page titles. Both routes render before the database Provider.

## Backup, recovery, and abuse verification

- Export through the UI produces a version-2 backup. Reset/restore recovers the semester, attendance, notes, planner, study history, preferences, curated favorites, and a saved custom look; values remain after reload.
- UI import rejects malformed JSON, prototype-related keys, unsupported versions, and wrong schemas without changing the active workspace or recovery counts. Destructive restore requires explicit confirmation. Cancelling semester replacement leaves live data unchanged; confirming creates a recovery point and clears only records for the replaced semester.
- A deliberately corrupted IndexedDB record opens the recovery screen. The record is retained until an explicit action; it is not silently discarded. The public Privacy Policy remains accessible. A validated backup restores the usable workspace after confirmation.
- Automated tests cover oversized/deep JSON before parsing, hostile text/Unicode, suspicious URLs, object getters/cycles/prototype keys, malformed file headers, image dimension bombs, malformed worker/OCR output, invalid sessions/references, corrupt recovery snapshots, failed migration preservation, bounded backup media, and complete deletion.
- A fake/malformed PDF produces safe feedback and does not mutate the semester. Real PDF workers and image OCR still work with the validation limits and CSP. These tests do not constitute exhaustive PDF/codec fuzzing or a penetration test.

## PWA, offline tools, headers, and updates

- The service worker installs, activates, controls the production page, and precaches the lazy Prism/theme chunks, fonts, icons, and shell. Manifest/start URL/icon responses and MIME types were inspected.
- Settings explicitly downloads the same-origin extraction tools and validates manifest paths, file sizes, and SHA-256 hashes. After preparation, the app reloads with browser networking disabled; an uncached fetch fails. All six core workspace pages, Settings, policies, and an actual image import remain usable offline.
- A waiting new production worker displays **Update app**. Applying it loads the new build while preserving academic data. An artificial obsolete extraction cache is removed on activation; the current prepared cache remains. Startup, visibility-return, and hourly update checks are implemented. Offline or unrefreshed clients can still retain old code.
- Local production responses include CSP, nosniff, no-referrer, Permissions-Policy, and frame denial. Three.js rendering, PDF workers, OCR WASM, service worker, and local assets work under that CSP. WASM compilation and dynamic inline CSS are the documented compatibility allowances; inline scripts and JavaScript unsafe evaluation are not enabled.
- `/privacy` and `/terms` return the application shell. Missing JS/worker/WASM files return 404 even when requested as HTML. Worker/manifest caching and JavaScript/WASM/gzip MIME handling were checked.

The actual public HTTPS host, TLS/HSTS/CDN policy, native install prompt flow, desktop installed-window lifecycle, and physical iOS/Android installation have **not** been verified. Loopback Chromium PWA/offline checks do not establish those results.

## Remaining limitations

English OCR and supported ECU/generic layouts can make mistakes. Academic values must be reviewed against official sources. Local browser storage and recovery copies can be lost through eviction, clearing, device loss, or origin changes; exported backups are unencrypted and should be protected by their owner. Large allowed documents can be slow on weaker hardware despite bounds/timeouts. Normal production checks had no application exceptions; the existing Three.js Clock deprecation warning remains. Tesseract can print informational resolution estimates on its error stream, and deliberately malformed/offline probes generate expected diagnostic messages.

Operator/contact information, source license, qualified legal review, private vulnerability reporting, hosted CI, real deployment checks, and physical-device beta testing remain launch gates. See [release readiness](docs/RELEASE_READINESS.md) and [the security report](docs/SECURITY_REPORT.md). Public screenshots in [docs/screenshots](docs/screenshots/README.md) use only labelled Demo Semester or empty/public pages.
