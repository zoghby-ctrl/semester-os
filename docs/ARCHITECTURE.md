# Semester OS architecture

## Academic domain and persistence

React pages consume `NormalizedSemester` through `lib/academic.ts`, `lib/scheduling.ts`, and the reactive context. The aggregate holds a student, university adapter identity, optional program/level, semester, stable courses, offerings, sessions, and rooms. Missing source fields remain unknown; overlaps remain distinct sessions. Attendance retains historical planned times.

`lib/db.ts` is the local repository boundary, backed by Dexie/IndexedDB `semester-os-v1`. Database version 2 adds recovery storage; preference/backup version 2 includes the normalized aggregate. The database name and old entity IDs remain unchanged. `legacy.ts` converts old settings and version-1 backups, and provides an explicitly selected, labelled demo. Fresh installations have an empty semester.

Repository writes validate runtime schemas and references. The context validates loaded data; corrupt data opens a recovery screen without silently overwriting it. Backup restore and semester activation validate before a transaction, then archive the prior workspace and replace data atomically. Recovery restores are validated too. Record reset retains preferences/timetable and creates a snapshot. Full workspace deletion explicitly removes preferences, academic data, wallpaper, timer, and recovery copies.

The repository functions isolate persistence from the application domain. A future IndexedDB/local storage adapter or optional sync adapter can implement that boundary without changing the semester model. There is no CloudSyncAdapter, backend, account system, telemetry, or remote student database in V1.

## Local importer

`importer/extract.ts` validates file size/type/signatures and image dimensions, then reads PDFs with a same-origin PDF.js worker or images/scanned pages with a same-origin Tesseract worker. File bytes never become application records directly. Extraction geometry and text pass through a bounded runtime schema. `parse.ts` interprets rows, grids, and plan columns using a university adapter; `confidence.ts` describes evidence and uncertainty. `normalize.ts` accepts only reviewed candidates, validates IDs/relationships, and constructs the domain aggregate.

The Welcome flow keeps source previews alongside editable fields. Every course and session requires confirmation. Layout-derived minutes remain visibly uncertain until review. Cancellation and a 180-second timeout terminate extraction work. Source blobs/previews are temporary and excluded from backups. The local OCR language is English; arbitrary university formats and recognition accuracy are not guaranteed.

Fresh setup has no adapter selected. `AcademicContext` includes optional university name and faculty, arbitrary program/level/term/specialization/dates, and field provenance. `academic-context.ts` detects explicit headings before the first course row; detection never reads catalog scope, code digits, filenames, demo records, or user filters as context evidence. Suggestions remain separate from confirmed fields. Context conflicts must be resolved before activation.

Material-plan review indexes bounded PDF text before rendering. Short PDFs can expose other candidate pages; long PDFs inspect only selected pages. Explicit page selections always determine the rendered/OCRed pages, even when codes do not match. Automatic selection is a visible suggestion; the selected page and detected academic context have independent review decisions. A small header strip on an already selected ruled scan preserves headings otherwise excluded by the table crop. No scan is fully OCRed just to find an alternative page.

The ECU catalog has six complete verified Computer Science records and four name-only references. Lookup respects explicitly incompatible institutions, programs, levels, and terms; it never seeds enrollment or supplies ECU metadata to generic imports. Adapter/context corrections remove obsolete catalog fields while preserving manual edits and sessions. Generic parsing extracts available row names, sessions, labelled credits, and prerequisite text and persists provenance.

The optional aggregate `academicContext` evidence is an additive change: normalized semester version 1, settings/backup version 2, IndexedDB name/version, IDs, and tables stay intact. Existing v2 data passes through migration without inferred context or new defaults. Version-1 workspace/backup conversion retains the historical owner records, and new evidence survives v2 backup/recovery validation. [The generalization report](PRODUCT_GENERALIZATION.md) includes the compatibility matrix.

## Appearance

`themes/schema.ts` validates selections, custom palettes, atmosphere controls, and saved configurations. `themes/definitions.ts` defines 13 curated identities and a custom theme with palette, surfaces, typography, primitives, motion/particle profiles, effects, contrast rules, budgets, and understandable settings. Theme tokens protect reading contrast, including custom mid-tone backgrounds.

`components/themes/ThemeScene.tsx` dispatches Prism to the existing lazy React Three Fiber scene and shares CSS primitives plus a batched, depth-layered canvas particle field for the other themes. Haze, ribbons, orbs, aurora, waves, bloom, grid/scanning nodes, dust, stars, and restrained distant streaks share this implementation. It does not approximate or replace Prism's instanced meteor engine. Ambient scenes cap frame cadence/DPR, pause while hidden, clamp delta time, and avoid per-frame React state. Preview rendering pauses outside the viewport. Mobile retains the atmosphere with a smaller budget.

The Appearance studio uses that actual renderer in a miniature representative dashboard. Choices save immediately; an undo restores the previous appearance. Curated favorites and up to 30 full saved looks remain local and travel in backups. Wallpaper remains a separate, locally stored media preference. Both OS and manual reduced motion override animation.

## Routes, privacy, and offline operation

The workspace retains hash navigation. `/privacy` and `/terms` are public path routes rendered before the database Provider, so policy access does not depend on onboarding or readable IndexedDB. Static hosts must serve the SPA fallback for those paths.

The generated PWA precaches the app shell, theme code, and fonts. Extraction assets use a same-origin, release-specific runtime cache. Settings can explicitly download and hash-check the approximately 24 MB local PDF/OCR tools for offline imports. Tool caches contain application assets, never uploaded documents. Activation removes obsolete extraction caches and Workbox removes old precaches. App updates are checked on startup, visibility return, and hourly while open; the user is prompted to save edits and refresh.

`scripts/security-headers.mjs` owns the intended static deployment policy. `serve.mjs` applies it locally; postbuild emits `_headers` and `_redirects` for compatible static hosts. Hosting, HTTPS, HSTS, infrastructure logging, CDN behavior, native installation, and physical-device performance require deployment-specific verification.
