# Architecture decisions

## 001 — Evolve the academic aggregate without replacing the application

**Problem:** record validation and UI imports were tied to one student's source module.

**Decision:** persist a validated, versioned `NormalizedSemester` aggregate alongside existing preferences. It owns student, university, program, level, semester, courses, offerings, sessions, and rooms. Existing record tables retain stable foreign IDs. `coursesFor`, `findCourse`, and `sessionsFor` project the aggregate into the existing components. The time override list remains a compatibility layer for historical timetable edits.

**Alternatives:** a new database and rebuilt UI would risk history loss; splitting every small domain concept into its own table would add intermediate incomplete states during confirmation without a current need.

**Reason:** one transaction can activate a coherent semester; each record remains independently editable. Adapters and import drafts never become UI data until reviewed and normalized.

**Migration implications:** keep the `semester-os-v1` database name, upgrade Dexie to version 2, archive pre-migration preferences, preserve old IDs/records/timer/wallpaper, and convert version-1 backups explicitly. New installations have no semester. Demo is opt-in and labelled. Semester replacement and restore retain full recovery snapshots, including active timers and wallpaper blobs.

## 002 — University configuration stays behind adapters

**Problem:** expanding the fixed ECU example could spread university assumptions throughout the UI.

**Decision:** `UniversityAdapter` owns code/room conventions, day/type interpretation, plan-header recognition, profile, and import guidance. ECU is the first adapter; a generic English timetable adapter is an explicit fallback. Neither contains a student catalog or guesses university policies.

**Alternatives:** a universal parser with hidden ECU defaults, or separate university applications.

**Reason:** shared extraction and review can operate with replaceable document conventions while academic screens consume only normalized data.

**Migration implications:** existing students are labelled with their known ECU context. Selecting a university alone creates no courses, credits, rooms, semester dates, or attendance rules.
## 003 — Local document extraction and reviewed candidates

**Problem:** selectable PDFs, scanned tables, and visual timetable grids have different failure modes. Reading recognition output as application data would hide uncertainty.

**Decision:** keep a replaceable `DocumentExtractor`, field-level candidate model, university interpretation, review validation, and normalized semester construction as separate stages. PDF.js reads text when the page has usable text coverage; Tesseract handles scanned pages and images using same-origin workers and English language data. Ruled-table preprocessing preserves the original preview. The ECU adapter defines the known twelve-column plan format; only detected table boundaries and matching course-code positions activate it. Visual time estimates and positional credits/hours are marked low confidence. All courses and sessions require review.

**Alternatives:** a remote OCR/AI service would require document uploads; shipping a fixed course catalogue could conceal recognition failures and become stale. Neither is used.

**Migration:** the importer creates candidates in memory and cannot mutate the active semester. Only confirmed normalized data reaches the repository. Source documents and preview images are released when setup closes and are not stored in backups. English OCR may misread small text; cropped relevant plan pages and manual corrections are supported.

## 004 — Shared themes around the preserved Prism renderer

**Problem:** visual identities need more than token swaps, while separate engines would multiply frame loops and maintenance risk.

**Decision:** typed definitions own palette, surfaces, typography, primitives, motion/particle profiles, effects, accessibility constraints, budgets, and understandable controls. Prism continues using its existing lazy R3F scene and pooled instanced meteors. Other identities share CSS primitives and one batched depth-layered particle renderer. The same dispatcher renders the Appearance preview and the actual workspace.

**Reason:** renderer previews stay representative; mobile atmosphere remains recognizable with smaller budgets. Visibility/reduced motion and delta bounds are shared, and per-frame work does not update React state. Automatic token contrast and protected surface opacity prevent unreadable custom palettes. Curated favorites and complete saved looks stay in validated local preferences/backups.

## 005 — Validate local boundaries and preserve corrupt-state evidence

**Problem:** TypeScript cannot validate hostile documents, JSON, worker output, or browser-storage manipulation; blindly applying these values can corrupt live records.

**Decision:** apply byte/structure/signature/dimension limits before decoding or replacement, then runtime schemas and foreign-reference validation. Backup conversion and recovery validation complete before atomic mutation. The reactive context checks loaded data; a failed check opens an explicit recovery screen without silently clearing records. Public policies render independently of the database. Complete deletion is distinct from record reset and removes recovery copies too.

**Reason:** local-first reduces collection but does not make input trustworthy or storage durable. Visible recovery and independent exported backups provide honest controls without adding a backend. Source previews are temporary. Backups and local storage are unencrypted; this limitation is disclosed.

## 006 — Separate offline shell readiness from extraction readiness

**Problem:** large OCR/WASM assets should not be silently downloaded with every first visit, and stale tools should not remain indefinitely cached across releases.

**Decision:** precache the application/theme shell; offer explicit preparation of same-origin extraction assets using a bounded manifest with sizes/hashes. Version extraction caches by the manifest revision and remove obsolete caches on worker activation. Check online for app updates on startup, visibility return, and hourly; ask the user to save edits before refreshing. Keep worker/vendor URLs revalidated and restrict SPA fallback to public policy routes.

**Reason:** students can see when offline imports are ready. No document is uploaded for preparation. Cache cleanup does not touch academic IndexedDB. Update checks improve patch delivery, while documentation acknowledges that offline/unrefreshed clients and actual CDN rollout remain operational concerns.

## 007 — Publish route content immediately

**Problem:** rapid hash changes while a waiting exit transition was active could update navigation/title while leaving the previous page visible.

**Decision:** retain a short reduced-motion-aware entry fade, but publish the keyed route immediately instead of waiting for an exit animation. Browser checks assert exact headings, active tabs, and settled opacity.

**Reason:** route correctness and usable keyboard/touch navigation take precedence over serialized decorative transitions. Theme and Prism rendering are unaffected.
