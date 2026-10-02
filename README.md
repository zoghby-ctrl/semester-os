# Semester OS

Semester OS turns your university timetable and academic plan into a personal academic operating system. Your courses, attendance, plans, notes, study time, and progress share one personal workspace. **Local-first. Accountless. Built for a semester you can make your own.**

[Try the live beta](https://semester-os-4y6.pages.dev) · [Public repository](https://github.com/zoghby-ctrl/semester-os) · [Setup and development](#installation-and-development) · [Contributing](CONTRIBUTING.md) · [Security reporting](SECURITY.md)

Semester OS is an independent project and is not affiliated with or endorsed by ECU or another university. The current release is a beta: review academic information against official sources and export backups of anything you need to keep.

![Today in Midnight, using a labelled demo with no personal profile](docs/screenshots/today-desktop.png)

## What you can do

- **Today:** see your current and next classes, rooms, overlapping sessions, upcoming plans, and a persistent study timer.
- **Schedule:** browse your week, filter sessions, edit exact times, and use a compact phone layout.
- **Courses:** keep notes, topics, tasks, assignments, attendance history, and saved study sessions together.
- **Planner and Progress:** organize due dates and track recorded attendance, late minutes, topics, and study time.
- **Appearance:** choose 13 curated themes or Custom, preview the actual renderer, favorite themes, and save looks. Prism retains its layered stars, pooled meteors, and spectral refraction. Midnight adds moonlit stars; Campus brings moving daylight; Focus keeps a quiet breathing light.
- **Access and recovery:** keyboard search with Ctrl/Cmd+K, direct phone navigation, reduced-motion controls, validated backup/restore, and local recovery points.

Attendance is recorded manually. There is no GPS or automatic presence detection, and an empty workspace begins without invented academic progress.

| Weekly schedule | Appearance studio |
| --- | --- |
| ![Anonymous labelled demo timetable](docs/screenshots/schedule-desktop.png) | ![Campus live preview and theme gallery](docs/screenshots/appearance-desktop.png) |

[Phone layouts and all reviewed screenshots](docs/screenshots/README.md) use an empty or anonymous labelled demo workspace. They contain no personal name, student ID, email, account details, or local filesystem path.

## University timetable importer

Fresh installations start empty. You can explore the optional **Demo Semester**, enter courses manually, or build a semester from your own authorized documents:

1. Choose **Egyptian Chinese University** for enhanced document recognition or **Another university** for the universal timetable importer. Fresh setup has no preselected university, program, level, or term.
2. Select a timetable PDF or image. A material-plan PDF/image is optional.
3. Local PDF text extraction or English OCR produces an editable draft alongside a source preview.
4. Check course names, weekdays, times, rooms, credits, prerequisites, and uncertain fields. Detected academic headings remain separate suggestions: confirm, change, or leave them unknown. Confirm each course and session.
5. Generate your semester. Replacing an existing workspace creates a local recovery point first.

Before first-run setup is complete, workspace navigation is visibly locked and explains how to unlock it. Upload and review a timetable, explore the labelled demo, or open an empty workspace. Navigation unlocks as soon as completion is saved; configured users can return to Setup without losing navigation access.

Recognition depends on the document and can be wrong, especially with image quality, unfamiliar layouts, or time placement. Missing information remains unknown. Successful checks of particular documents do not establish an OCR accuracy rate. Always review the draft against your university's official timetable.

Works with university timetables generally, with enhanced recognition for selected document formats. ECU is the first enhanced adapter; this does not establish support for every ECU faculty or curriculum. Both flows accept optional university name (generic), faculty/school, program, any level/year, any semester/term, specialization, and dates. Leave anything you don’t know blank.

Explicit material-plan PDF page selections are honored, including pages with different course codes. Short PDFs are indexed from selectable text to suggest likely matches before rendering; long PDFs require a bounded selection. Visible headings supply context evidence. Your entered context only filters candidates; course codes, catalog scope, demo data, and page position never prove a level or term. Page conflicts require review: keep the selected page deliberately, use a suggested page, or choose another page. Nothing silently changes your selection.

The local ECU catalog contains **six verified complete Computer Science Level 2 / Semester 1 records and four name-only prerequisite references**. It is metadata, not the full ECU curriculum or an enrollment list. Compatible ECU context and a verified code can supply editable canonical values; unknown/ambiguous codes and incompatible levels, terms, or programs retain document/manual values. Generic universities receive no ECU metadata. [Generalization audit and validation](docs/PRODUCT_GENERALIZATION.md) records the boundaries.

Documents are processed by same-origin PDF/OCR workers on the device. There is no remote OCR, AI upload, or student-document server.

## Privacy and local storage

Semester OS uses Dexie/IndexedDB in your browser. There are no accounts, passwords, cloud sync, student backend, analytics, advertising integrations, or telemetry in the application. In normal operation, academic records stay on your device; the host still receives ordinary requests for application code, fonts, and extraction tools.

Source documents and previews are temporary and are excluded from exported backups. Backups are **unencrypted** and can contain personal academic information. Import validates the backup before a confirmed atomic replacement. Settings offers record reset, recovery management, and complete local workspace deletion.

Browser storage can be cleared or evicted. Export backups regularly and keep them somewhere you control. A different browser, device, hostname, or port has separate storage; export before changing origins. Active timers are kept locally but are excluded from exports, so save the session first.

The Privacy Policy and draft Terms are available before onboarding and in About & legal. Operator/contact and qualified legal review remain release tasks; see [release readiness](docs/RELEASE_READINESS.md).

## PWA and offline

The production PWA precaches the application shell, local fonts, icons, and theme code. Once the service worker controls the page, core workspace pages and policies can reopen offline.

Before relying on **offline imports**, explicitly prepare the approximately 24 MB of extraction tools in Settings → Data & backup. Installing the shell alone does not prepare OCR.

Install from your browser when offered; on Safari for iPhone/iPad, use Share → Add to Home Screen. An update banner offers a refresh when a new build is ready. Updates replace application caches without deleting academic IndexedDB. Native installation, storage eviction, battery use, and long sessions still need broader physical-device beta testing.

## Installation and development

Use **Node 24** (CI's version), or Node 22.13+ with a compatible npm version.

```sh
npm ci
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). Asset preparation runs automatically before development, tests, and builds.

To run the production PWA locally:

```sh
npm run verify
node serve.mjs
```

Open [http://127.0.0.1:4173](http://127.0.0.1:4173). On Windows, **Start Semester OS.cmd** starts this server. Serve over HTTP; opening the built HTML file directly will not provide the application environment.

```sh
npm test                 # complete suite: 265 tests in 21 files
npm run lint
npm run typecheck        # strict TypeScript
npm run build            # dist/ with PWA, Pages headers and routes
npm run security:audit   # production and full dependency audits
npm run security:scan    # source/build secrets and unsafe-code patterns
npm run repository:audit # public-source allowlist and privacy checks
npm run verify:pages     # deployment files, headers and extraction hashes
npm run verify          # all automated release checks
```

No secret is required to build. The optional `VITE_PROJECT_CONTACT` is a **public** project contact compiled into browser code; never put credentials in frontend environment values. See [.env.example](.env.example).

## Architecture

React 19 and TypeScript render the workspace; Vite and Workbox provide the production/PWA build. A validated local repository owns mutations and recovery. University adapters interpret documents into a reviewable draft before normalization and activation.

| Area | Responsibility |
| --- | --- |
| `src/lib/domain.ts`, `schema.ts`, `db.ts` | Academic model, validation, IndexedDB, backups and recovery |
| `src/universities/`, `src/importer/` | ECU/generic interpretation and local PDF/OCR extraction |
| `src/themes/`, `src/components/themes/` | Theme definitions, saved looks, adaptive quality, shared Canvas2D worlds |
| `src/components/prism/` | Preserved Three.js/Fiber Prism renderer |
| `src/pages/` | Setup, workspace, settings and public legal pages |
| `scripts/`, `.github/` | Reproducible assets, deployment checks, privacy/security gates and CI |

Navigation remains hash-based; public legal pages have explicit pathname routes. Existing workspace IDs and version-1 backup migration are preserved. [Architecture](docs/ARCHITECTURE.md) and [decisions](docs/DECISIONS.md) explain the boundaries.

## Contributing and security

Read [CONTRIBUTING.md](CONTRIBUTING.md), use synthetic data or the authorized anonymous demo, and run the relevant checks plus `npm run verify`. Do not attach personal documents, backups, credentials, or private screenshots to commits or public issues.

Report vulnerabilities privately using the channel described in [SECURITY.md](SECURITY.md). GitHub private vulnerability reporting is currently disabled and a monitored contact is not configured; enabling a private channel remains a release task. Do not put exploits or student data in public issues.

## Beta and license status

The live beta is [semester-os-4y6.pages.dev](https://semester-os-4y6.pages.dev). The optional `semesteros.is-a.dev` alias remains pending its is-a.dev PR merge and Cloudflare custom-domain setup; it is not a production address.

The current local product-generalization pass retains the verified 194-test code-first baseline and passes **265 tests across 21 files**, alongside lint, strict TypeScript, production/PWA, dependency and security/privacy gates. Production-browser checks cover 1440, 900, 390, and 320 pixels. This continuation has not been committed, pushed, or deployed; published-source and hosted validation from earlier milestones do not verify these local changes. These checks do not establish production readiness, legal approval, penetration-test certification, or all-device OCR/PWA reliability.

**No source license has been selected.** The repository is publicly available, but source availability does not imply permission to reuse, modify, or redistribute the code. No license or legal guarantee is inferred from publication. Third-party dependencies retain their own licenses.

[Validation](VALIDATION.md) · [Onboarding and beta release preparation](docs/BETA_RELEASE_PREPARATION.md) · [Draft beta release notes](docs/releases/v0.1.0-beta.1.md) · [Release readiness](docs/RELEASE_READINESS.md) · [Cloudflare redeployment](docs/DEPLOYMENT.md)
