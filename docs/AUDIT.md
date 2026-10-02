# Semester OS migration audit

Completed October 1, 2026, before changing application source.

## 1. Current architecture

React 19 / TypeScript / Vite SPA, with hash navigation in `App.tsx`. Six page modules share a live Dexie context and a one-second local clock. Pure scheduling functions calculate recurrence, attendance states, and lateness. Zod validates preferences, records, and backups. IndexedDB stores settings, attendance, topics, planner items, notes, study sessions, wallpaper blobs, and an active timer. Radix provides accessible dialogs; cmdk provides keyboard search; Motion handles page transitions. Vite PWA generates the manifest, precache, and update prompt.

The academic source is a module containing six courses and eleven recurring sessions. Almost every screen imports it directly. Course IDs serve as course codes. Schedule settings store time overrides against those fixed IDs. There is no importer, university adapter, or new-student setup.

## 2. Technical debt

- Source, UI, validation, and persistence all assume one fixed semester. Validators require exactly eleven sessions and known source IDs.
- Hash navigation is adequate for this scope, but unknown routes and academic metadata need safer handling.
- Database initialization only fills Prism preference defaults. There is no academic schema version or recoverable migration journal.
- README and VALIDATION report 33 tests; the actual suite has 45. Several Prism descriptions predate the pooled meteor engine.
- No lint script, CI, contribution guide, security policy, or licensing decision is present.
- The directory is not a Git checkout. Generated browser artifacts and source documents are mixed with release material.

## 3. Personal-user assumptions

The initial name, page title, manifest name, and README identify the original developer. Course counts, 17 credits, Level 2 / Semester 1, program, Sunday–Tuesday campus days, and featured course IDs are embedded in components. A clean browser immediately inherits the original timetable. Original academic documents must remain private development inputs; new production users must receive empty academic data and default visual preferences.

## 4. UX weaknesses

The existing appearance is coherent and should be retained. Desktop and 390px mobile Schedule were visually inspected before edits; neither had horizontal overflow. First-run setup is missing. Mobile Schedule selects Tuesday on an unscheduled Thursday. Unknown rooms/names, one-course semesters, arbitrary weekdays, and overlapping classes are not supported. Material-plan absence cannot be distinguished from zero credits or no prerequisite. Theme cards use static swatches rather than the live renderer. Mobile Planner discovery depends on search/Today. Error messages can expose raw schema details.

## 5. Product gaps

Reusable academic context; clean onboarding and labelled demo; document extraction and review; uncertainty/provenance; university adapters; dynamic course/session relationships; richer theme definitions, previews, favorites, and accessible custom palettes; public repository documentation and CI. Existing attendance, planner, notes, timers, wallpaper, backup, and PWA provide a strong base.

## 6. Importer requirements

An explicit local pipeline: file validation → PDF text or OCR with geometry → candidates → adapter interpretation → field confidence → editable review → validated normalized semester → atomic activation. PDF text should take priority over OCR. Timetable grids require positional interpretation of day headers and time-axis labels. Block-derived minutes must remain uncertain. Never seed a failed import with the developer's schedule. Missing names, rooms, credits, and prerequisites must remain missing until supplied or confirmed. Material-plan enrichment must use uploaded evidence rather than assumed course catalogs. Keep source preview available throughout review and allow manual recovery. Bound file size, page count, image dimensions, and extraction runtime; release workers/resources on cancel. No document upload or AI server is required.

## 7. Data-model risks

Existing records refer to stable session IDs; changing those would orphan attendance and notes. Migration must preserve IDs, preferences, timetable edits, historical planned times, timer, wallpaper, and all records. Schema changes must be explicit, versioned, transactional, idempotent, and retain the previous settings for recovery. New backups must include normalized academic data; version-1 backups need a dedicated legacy converter. Referential validation must be scoped to the actual semester rather than the developer fixture. Overlaps should be reported and render safely; uncertainty must not enter normalized data as invented certainty.

## 8. Theme architecture assessment

Prism already has a lazy R3F Canvas, stable three-layer star buffers, instanced pooled meteor quads, projection-based traversal, reduced-motion static rendering, capped delta times, visibility handling, adaptive DPR, and SVG fallback. Preserve these modules. The actual cadence is up to 36fps desktop / 30fps compact, not the older README's 24/20. Other themes share CSS tokens and ambient primitives, but lack a typed definition, meaningful live preview, saved combinations, and equivalent atmospheric detail. Extend shared rendering and tokens; do not replace Prism or create separate engines.

## 9. Migration strategy

Retain the existing database name and record tables. Add a versioned normalized academic aggregate, generalize IDs, and project it through existing scheduling/component APIs. Confine the original source transcription to a legacy migration and explicitly selected demo/fixtures. Preserve previous settings in a migration recovery table. Validate backups and references before transactions. New semester creation requires a reviewable draft and preserves a recoverable snapshot of the previous workspace. No cloud, accounts, telemetry, or automatic presence detection.

## 10. Recommended implementation phases

1. Versioned domain aggregate, safe legacy migration, dynamic screens, clean first run, labelled demo, version-2 backups. Gate: all old tests retained or strengthened, new schema/migration tests, typecheck/build, desktop/mobile.
2. University adapter boundary with ECU conventions and a generic adapter. Gate: no ECU logic in academic pages; adapter tests.
3. Local PDF/OCR pipeline and provenance-based confidence. Gate: real supplied documents, malformed/partial inputs, parser and confidence tests.
4. Welcome/context/upload/review/confirm onboarding, source preview, editable fields, manual fallback, safe semester activation. Gate: fresh student, corrected import, optional plan, demo, existing student.
5. Dynamic Today/Schedule/course/planner/progress behavior, arbitrary weekdays, missing metadata, safe overlap layout. Gate: one/many/empty/consecutive/overlapping sessions and manual attendance/lateness.
6. Shared theme definitions/renderer, curated themes, live preview, favorites, accessible custom settings, reduced motion and visibility. Gate: preserve meteor tests, desktop/mobile theme checks.
7–10. Grouped settings, local-first privacy, recoverable versioned portability, installable offline PWA including local extraction assets. Gate: reload, export/restore, offline controlled reload.
11. Honest README, architecture/decisions, contribution/security/setup guides, templates and CI. Recommend a license without adopting one for the owner. Gate: secrets/personal-data scan and final acceptance matrix.

## Baseline verification

- `npm test`: **45 passed / 4 files**.
- `npm run check`: passed.
- `npm run build`: passed; 35 precache entries / approximately 2 MiB.
- Lint: not configured.
- Running production app inspected at 1440×960 and 390×844; Today and Schedule captured in `output/playwright/audit-*.png`. Original Prism starfield and multiple meteor trails visible.
- Emulated OS Reduce Motion changes Prism to static; mobile overflow check passed.
- Browser service worker activated and controlled the page after reload; offline reload and Schedule navigation loaded successfully. Native installation is not verified.
- Existing automated persistence/backup tests cover reopen, retained history, recovery round trip, invalid input, and reset preference retention. Full manual backup/recovery will be repeated after migration.
- No physical mobile-device, GPU power, native background-tab, or iOS installation measurements were made. Existing Three.js Clock deprecation warning is non-blocking and remains a dependency limitation.

Application source, all page/component/model/test files, theme/layout/Prism styles, build/server configuration, existing documentation, source timetable image, and previous browser reports were inspected. Phase 1 follows this audit automatically.

## Continuation outcome — October 1, 2026

The sections above are the historical pre-migration audit. The continuation started from the already verified **72-test normalized-semester/importer baseline**. It did not restart the migration or restore older files.

- Added shared typed theme definitions, contrast-protected tokens, CSS atmospheric primitives, batched canvas particles, renderer-based miniature previews, immediate/reversible/persistent application, curated favorites, and full saved custom looks. Thirteen curated identities and Custom are available. The original Prism scene, shaders, pooled meteor system, and scheduling tests remain unchanged.
- Organized Settings, kept an accountless local repository, added honest local-first copy, public policy/Terms routes before the database Provider, configurable public contact, and visible recovery/deletion controls.
- Hardened hostile JSON/object/file/media/worker/domain/backup boundaries with bounded runtime validation, signature/dimension checks, referential validation, safe migration/recovery, and an explicit corrupt-storage screen. No backend, accounts, SQL database, cloud document uploads, telemetry, or analytics were introduced.
- Added same-origin hash-checked offline tool preparation, versioned extraction cache cleanup, online update checks/prompt, compatible CSP/security headers, safe asset MIME/fallback behavior, and production source-map/secret/unsafe-code checks.
- Added lint, lockfile-based CI/security gates, pinned actions, Dependabot, contribution/security/reporting guidance, architecture/deployment/threat-model documentation, release readiness, and reviewed demo/public screenshots. Original academic documents and private verification output are excluded from public staging.
- Browser QA found and fixed narrow import-review grid overflow, long room/text overflow, a first-run activation/navigation race, and rapid-route transition waits that could display stale content. The final matrix waits for exact page headings and settled opacity; 44 checks pass at 320/390/900/1440 pixels.
- Final local gates: clean `npm ci`, lint, strict TypeScript, **93 tests / 10 files**, production build, zero known vulnerabilities in both dependency audit scopes, and no matching redacted scan findings. Production shell has 39 precache entries / approximately 2.56 MiB.
- Actual local PDF and prepared-tool offline image OCR preserve the supplied 6-course/11-session result. Attendance/lateness, Planner, course work, timer, theme persistence, backups/recovery, malicious text/backup rejection, corrupt storage, fresh demo/empty/manual setup, reduced motion, offline pages/policies, and worker updates were exercised.

See [current validation](../VALIDATION.md), [security findings and remaining risks](SECURITY_REPORT.md), and [release readiness](RELEASE_READINESS.md). Subsequent work verified the public repository, main's hosted CI and 34 live HTTPS route/asset/header checks. Native/physical-device installation, external-student usability, a private reporting channel, operator/contact/license decisions and qualified legal review remain beta release tasks. The new onboarding fix still needs its own push, CI and deployment checks. Local checks are not legal/security certification.
