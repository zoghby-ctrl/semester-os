# Semester OS product generalization

October 2, 2026. Continued from the clean current checkout at `7017edb` (`Use ECU course codes for deterministic catalog enrichment`). Before editing, the complete `npm run verify` pipeline passed: **194 tests in 20 files**, lint, strict TypeScript, production/PWA build, both dependency audits with zero vulnerabilities, source/build security scan, repository audit (145 files), and Pages artifact checks. No restart or importer rewrite was performed.

## 1. Every academic assumption found

The audit covered production source, adapters, extraction/review/normalization, storage/migration, tests, README, Help, and historical documents. These are the actual findings; no hardcoded semester page number was found in the current baseline.

| Location in the baseline | Assumption or coupling | Result |
| --- | --- | --- |
| `src/pages/Welcome.tsx`, initial `AcademicContext` | Fresh setup silently selected `adapterId: "ecu"`. | Removed. A deliberate university choice is required. |
| `src/pages/Welcome.tsx`, context form | Only adapter identity could identify the university; no custom university name or separate faculty/school field. Context could not be corrected in review. | Added optional fields and a review editor. |
| `src/importer/types.ts`, `AcademicContext` | Context had no detected/confirmed separation or context provenance. | Added suggestions and explicit decisions, separate from editable confirmed inputs. |
| `src/importer/normalize.ts` | Always used `adapter.profile`, discarding a generic university's actual name. Specialization existed only inside a nonempty program. | Custom university, independent faculty/specialization, and context evidence now survive activation. |
| `src/data/ecu-catalog.ts`, `scope` | Six complete records were explicitly CS/L2/S1 metadata, with four prerequisite names. The bounded catalog disclaimer was present, but program was not a structured lookup constraint. | Retained all verified records, formalized scope and counts, added program constraints. No curriculum added. |
| `src/universities/ecu-codes.ts`, `narrow()` | A single catalog entry bypassed level/term filtering. Filtering multiple entries also fell back to incompatible entries. Program/institution were not checked. | Every record now respects explicit incompatible context; context cannot force a match. |
| `src/importer/extract.ts`, name refinement | The catalog shortcut checked codes without supplied academic context, so an incompatible program/term could still skip needed document-name OCR. | Shortcut now uses the same scoped lookup as enrichment. |
| `src/importer/extract.ts`, PDF skip | A page with nonmatching codes could be discarded even when explicitly selected. This hid source evidence rather than replacing the page with a literal fixed page. | Explicit pages are retained, rendered, and reviewable. |
| `src/importer/extract.ts` / `page-selection.ts` | Code overlap was the only plan relevance check; no visible heading index or page/context conflict review existed. Page ranges themselves were already bounded and honored at PDF access. | Added bounded text indexing, page suggestions, visible conflicts, and user resolution. |
| `src/importer/parse.ts`, catalog-first enrichment | A known code could supply metadata even with no matching plan rows. This is useful metadata, but without separate context/page evidence it could look like proof of L2/S1. | Kept code-first metadata; made context and page evidence independent and explicit. |
| `src/importer/parse.ts`, enrichment boundary | Only the passed adapter gated catalog enrichment; no check prevented an ECU adapter from enriching a generic result. | Added adapter/result identity validation and safe adapter correction. |
| `src/importer/parse.ts`, generic parsing | Timetable names were always omitted, generic prerequisite prose could be lost, and aligned weekday rows could be mistaken for grid headers. | Generic row names, text prerequisites, and row/day handling now work with provenance. |
| `src/importer/extract.ts`, selectable-text threshold | Sparse structured timetable PDFs could be sent through OCR despite usable text. Cropping a ruled scan also omitted academic headings above its table. | Structured text avoids unnecessary OCR; only a small heading strip on an already chosen scan gets extra OCR. |
| `src/importer/normalize.ts` | Course provenance was persisted only when at least one field used the ECU catalog. | Persisted provenance also supports generic/document/manual fields. |
| `src/universities/index.ts`, README importer section, Help | Adapter copy foregrounded the owner's CS/L2/S1 catalog; README presented an “ECU importer” and stale milestone counts. | University-first wording, honest selected-format support, optional context, and explicit catalog boundaries. |
| `src/data/legacy-academic.ts`, `src/lib/legacy.ts` | Original six courses, eleven sessions, ECU/CS/L2/S1 IDs, and an eleven-session old-schema migration guard remain. | Intentionally retained only for explicit Demo Semester and the historical owner workspace/backup conversion. No import inference uses them. |
| Regression fixtures and historical audit/release documents | Owner codes/context and earlier validation totals appear as labelled fixtures or historical observations. | Tests retained. Milestone documents are labelled/superseded; they are never input to import detection. |

The verified ECU adapter's **12-column table mapping** remains. It is used only when actual ruled boundaries and the code column match that known structure. It is not a page number, fixed row number, faculty inference, or curriculum list. All rows are located from their uploaded geometry. Existing normalized settings already began with `semester: null`; there was no persisted fresh Level 2, Semester 1, or CS default to delete.

## 2. Assumptions removed

Removed the implicit ECU selection; single-entry catalog scope bypass; incompatible-context fallback; unscoped OCR shortcut; explicit-page discard; catalog-as-context ambiguity; adapter/result mismatch; inability to save a custom university/faculty or independent specialization; missing context review; generic name/prerequisite loss; grid interpretation of weekday rows; and ECU-first product positioning. Source evidence never comes from the demo, catalog scope, code digits, filename, or PDF position.

## 3. New fresh-user onboarding

“Where do you study?” presents **Egyptian Chinese University — Enhanced document recognition** and **Another university — Universal timetable importer**. Neither is selected initially. Optional fields remain under a concise disclosure: faculty/school, program, any level/year, any semester/term, specialization, and dates; generic mode also offers an optional university name. The guidance says to leave unknown information blank and confirm any document suggestions. Timetable-only, manual, labelled demo, and empty-workspace completion paths remain available. Setup navigation unlocks only after saved completion, as before.

## 4. ECU flow

ECU enables selected layout/code conventions, not an assumed faculty or semester. Levels 1–4, semesters 1/2, summer/other terms, custom programs, and unknown context are valid. Explicit incompatible context prevents the scoped catalog from filling unrelated metadata. Document/manual fields remain editable. A known code in compatible or unspecified context can still receive its verified metadata without inferring enrollment, level, program, or term.

## 5. Generic flow

Custom or unnamed universities use the generic adapter. It reads supported English code/day/time rows or timetable grids, available row names, rooms/session types, labelled plan credits, and prerequisite codes or free text. Missing fields remain unknown and all values are editable. Generic mode never uses ECU canonical metadata or ECU structural OCR code repair. Course provenance now persists for generic imports as well.

## 6. Context detection model

Confirmed context is the user's editable input. Detected context is a separate bounded collection of field/value suggestions carrying document role, filename, original PDF page, method, confidence, recognition score, and reason. Detection reads explicit visible headings above the first course row in the upper page region. It supports labelled university/faculty/program/specialization/date headings, numeric/selected ordinal level/term headings, named English seasons, and selected Arabic text headings when present in PDF text. It does not invent missing fields.

The review shows “Semester OS found” or “Possible match — please check,” with Confirm/Change/Keep/Leave unknown actions. Multiple conflicting headings stay uncertain and require choosing one value. Low confidence is never auto-confirmed. Confirming a university heading cannot silently enable ECU recognition; confirming a different institution removes ECU recognition. Saved `academicContext.confirmed` contains provenance only for supplied/confirmed fields, while `detected` remains evidence rather than authoritative context.

## 7. Page selection

PDF numbering counts the cover as page 1. Explicit selections always determine which pages are rendered/read, including irrelevant or conflicting pages. A short plan (up to 20 pages) is indexed from selectable text to expose likely page matches and alternatives without rendering/OCRing every page. Longer PDFs require an explicit selection; inspection stays within up to 20 selected pages of a document capped at 500 pages.

User context filters candidates; it does not prove their headings. Course overlap is relevance evidence, not level/term evidence. Automatic matches are worded as “We found a likely match on page N.” Original page numbers are retained. Equal candidates and pages with unknown headings remain reviewable. Tests place L2/S1 at pages 1, 6, 17, and 101, with Level 1 pages before/after it; actual browser PDFs put the wrong selected page at 4 and the suggested match at 9.

## 8. Conflict handling

The review displays the detected page heading and supplied context: for example, “This page appears to describe Level 2 · Semester 1, but you selected Level 1 · Semester 1.” Activation remains blocked until the user resolves the conflict. They may **Keep selected page**, **Use detected page**, select another indexed page, or return to choose a range. Keeping a page is an explicit decision and does not change the user's context. Confirming detected context is a separate action. Reading another page replaces that page's evidence/metadata, preserves manual corrections/session edits, and refreshes hour inputs. Incomplete course drafts do not crash context editing; final validation remains strict.

## 9. ECU catalog scope

Exactly six existing complete CS Level 2 / Semester 1 records, plus four existing name-only prerequisite references. The records and legacy course/session order are preserved. There is no complete ECU catalog, new faculty list, scraped curriculum, generated enrollment, or new academic course data. A non-CS program or incompatible level/term keeps document/manual values. An unspecified faculty/program is not silently saved as CS.

## 10. Course-code enrichment

Compatible ECU + recognized `CSC2105` + mangled name still gives editable **Artificial Intelligence** and verified available metadata. Case/separators and bounded O/0 or I/1 structural repair retain existing behavior and uncertainty. Unknown codes keep source/manual values; wildcard, ambiguous, and repaired unknown codes do not guess an identity. Generic + `CSC2105` never receives the ECU name. Changing adapter/scope/code removes obsolete catalog fields while retaining explicit corrections. No fuzzy course-name matching was added.

## 11. Existing-user migration and backups

Normalized semester version 1, settings/backup version 2, Dexie database name/version, IDs, and tables remain unchanged. New faculty/specialization/context evidence is optional additive data. The existing v2 migration validates historical data without filling missing evidence or re-enriching courses; an old owner's ECU/CS/L2/S1 workspace remains exactly that workspace. The existing v1 workspace/backup converter continues to preserve historical IDs/context and recovery snapshots. Modern evidence round-trips through v2 backup validation and recovery.

Compatibility regressions cover attendance, planner, notes, topics, saved study history, active timer, settings/themes, existing recovery points, reopen, old v1/v2 backups, and unchanged historical metadata absence. Timer exclusion from exported backups is preserved. Newly introduced source references are released when setup completes; object URLs are revoked. Backups contain bounded provenance, including document filenames/headings, but not uploaded source blobs or previews.

## 12. Exact files changed

New:

- `src/components/AcademicContextFields.tsx`
- `src/importer/academic-context.ts`
- `src/importer/generalization.test.ts`
- `docs/PRODUCT_GENERALIZATION.md`

Modified:

- `README.md`
- `VALIDATION.md`
- `docs/ARCHITECTURE.md`
- `docs/BETA_IMPORT_GUIDANCE.md`
- `docs/ECU_CODE_FIRST_ENRICHMENT.md`
- `src/components/WorkflowGuide.tsx`
- `src/data/ecu-catalog.ts`
- `src/importer/ecu-enrichment.ts`
- `src/importer/extract.test.ts`
- `src/importer/extract.ts`
- `src/importer/normalize.ts`
- `src/importer/page-selection.ts`
- `src/importer/parse.ts`
- `src/importer/types.ts`
- `src/importer/validation.ts`
- `src/lib/domain.test.ts`
- `src/lib/domain.ts`
- `src/lib/legacy.ts`
- `src/onboarding.test.tsx`
- `src/pages/ecu-review.test.tsx`
- `src/pages/Welcome.tsx`
- `src/styles.css`
- `src/universities/ecu-codes.ts`
- `src/universities/index.ts`

Private browser evidence uses ignored `output/playwright/generalization/`. Public screenshots, dependencies/lockfile, security headers, PWA configuration, Prism, and theme renderer/definition files are unchanged.

## 13–18. Automated verification and privacy

All **194 baseline tests** are retained. The final suite adds **71 regressions**, for **265 tests in 21 files**. The added matrix spans fresh neutrality, arbitrary ECU context, incompatible catalog scope, custom universities, page numbering/conflicts/suggestions, generic extraction/editability, detected context decisions, incomplete review forms, and backward compatibility.

| Requested report item / command | Final result |
| --- | --- |
| 13. `npm test` | PASS — 265 tests in 21 files; 71 added, none deleted |
| 14. `npm run lint` | PASS |
| 15. `npm run typecheck` | PASS — the explicit alias was run separately; verification also passes `npm run check` |
| 16. `npm run build` | PASS — strict TypeScript and production/PWA build; 38 precache entries, 2571.22 KiB |
| 17. `npm run security:audit` | PASS — production and full dependency scopes each report zero vulnerabilities |
| 18. `npm run security:scan` | PASS — no matching secrets, unsafe application DOM APIs, unreviewed browser environment values, or production source maps |
| 18. `npm run repository:audit` | PASS — 149 source/config/documentation/public files; ignored private QA artifacts excluded |
| `npm run verify` | PASS — complete pipeline, including all checks above and Pages artifact validation |
| `npm run verify:pages` | PASS — 52 files; largest 3.72 MiB; local extraction asset hashes, routes, headers, manifest, icons, fonts, and privacy allowlist |
| `git diff --check` | PASS — no whitespace errors |

Final verification completed against the finished implementation. Subsequent changes only record its results in this report and `VALIDATION.md`; the repository/privacy audit is repeated after those documentation edits. The baseline's extraction/page limits and lazy same-origin tooling are retained. Short plan indexing reads text only; the browser automatic-selection scenarios render one plan page, and the long-PDF regression indexes only explicitly selected pages.

| Requested cases | Principal regression coverage |
| --- | --- |
| 1–4 | `generalization.test.ts`, `onboarding.test.tsx`, `domain.test.ts` |
| 5–13 | Context matrix and incompatible scope cases in `generalization.test.ts` |
| 14–20 | `page-selection.test.ts`, `extract.test.ts`, context/page tests, real review UI |
| 21–25 | Retained `ecu-enrichment.test.ts`, adapter tests, scope and adapter correction regressions |
| 26–30 | Generic names/sessions/prerequisites/custom universities and manual flow |
| 31–35 | Separate suggestions, low confidence, explicit confirmation, conflict blocking/keeping |
| 36–38 | `domain.test.ts`, `db.test.ts`, v1/v2 migration/restore, neutral post-demo setup |
| 39–42 | Real App/Provider/onboarding/navigation tests plus production browser flows |

No accounts, cloud storage, AI/OCR service, telemetry, backend, dependency, or remote curriculum source was added. All documents stay in same-origin local extraction. Existing validation, timeout/cancellation, file/page/word/image limits, CSP, worker ownership, and security/privacy scans remain in place. Pattern scans and local browser checks are not a security certification.

## 19. Responsive and browser verification

**50 production Chromium scenarios passed**, using isolated synthetic fixtures against `node serve.mjs`. The actual PDFs/images were submitted through the UI; these are not mocked extraction calls. The user's browser workspace was not altered.

| Browser flow | Widths | Passing scenarios |
| --- | --- | ---: |
| Neutral fresh onboarding; no selected university or implicit level/term/program | 1440 / 900 / 390 / 320 | 4 |
| Generic university + timetable/material plan, source credits/prerequisite text, editable names, activation | All four | 4 |
| ECU Level 1 Semester 1 and ECU Level 2 Semester 1, source versus scoped canonical names | All four | 8 |
| Another ECU level/custom program and unknown ECU context; no fixture enrollment | All four | 8 |
| Manual custom university, course/session entry, unknown context, activation | All four | 4 |
| Explicit selected page 4 conflicts with supplied Level 1; keep selected or read suggested page 9 | All four | 8 |
| Automatic heading-based page 9 suggestion; only one plan page rendered | All four | 4 |
| Existing owner-format v2 backup export/restore, recovery and records, controlled offline schedule reopen | All four | 4 |
| Actual local English OCR: timetable image, 12-column plan image, heading strip; detected context left unknown | 1440 / 390 | 2 |
| Generic timetable-only import; university/Level 3/Semester 2 explicitly confirmed, editable name retained | All four | 4 |

All 48 PDF/manual/workspace layout scenarios had no horizontal overflow at their requested width. The two actual OCR runs had zero application exceptions and zero remote requests, preserving `CSC2105` → Artificial Intelligence while level remained null and the term retained its neutral “My semester” label. All 50 scenarios had zero application exceptions; the existing Three.js Clock deprecation warning remains.

Compatibility fixtures contain all six historical ECU courses and eleven sessions, plus attendance, notes, planner items, topics, and study history. Restoring through the real backup UI retained all records, created a recovery point, left old context evidence absent, and preserved exact settings through offline reload under a controlling service worker. The four checks use Midnight, Campus, Focus, and Prism respectively. Targeted source/review and offline screenshots were visually inspected.

Browser testing identified a mobile source-panel offset that intercepted manual “Add course” clicks. The importer-scoped positioning fix resets it in the mobile layout and now passes actual pointer interactions at all widths, without changing theme renderers.

## 20. Remaining limitations

- The owner's actual screenshots/backup were not attached to this continuation. The received working baseline and its original enrichment tests were retained and verified; synthetic PDFs/OCR images do not establish accuracy on every actual student document.
- English local OCR and selected explicit headings/layouts remain bounded. Arabic image text is not transcribed; generic code/row recognition is not a guarantee for every university format. Nonstandard fields can be entered manually.
- Heading detection is conservative and reviews ambiguous/missing context. Scanned alternative pages are not blindly OCRed to discover a match; long PDFs need selected page numbers.
- The six complete ECU records and four names are the full extent of verified catalog data available here. Unknown curricula, faculties, and future plan changes remain document/manual work.
- Offline extraction needs the existing explicit tool preparation; shell caching alone supports workspace reopen. Physical-device performance/storage eviction and installed PWA behavior retain the prior beta limitations.
- This continuation has not been published. Owner review remains the next step.

## 21. Recommended commit message

`Generalize university onboarding and academic import context`

No commit, push, deployment, tag, or release was performed.
