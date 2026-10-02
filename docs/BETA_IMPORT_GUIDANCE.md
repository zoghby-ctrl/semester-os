# Beta import performance and workflow guidance

Follow-up: [ECU code-first enrichment](ECU_CODE_FIRST_ENRICHMENT.md) supersedes the free-form name OCR strategy below. Known ECU codes now use catalog defaults and skip the extra name-column OCR pass. The earlier verification figures below describe the preceding pass; the current total is 194 passing tests.

October 2, 2026. Continued the existing public repository from commit 6731fcd on main, matching origin/main and the deployed production source. This pass is local and uncommitted; nothing was pushed or deployed.

## Import changes

- Setup accepts optional timetable and material-plan PDF page ranges, such as 4-5 or 2, 7-9. Page numbers count the PDF cover as page 1. Blank reads all pages only for PDFs of at most 20 pages. Longer PDFs require an explicit selection, bounded to 20 selected pages in a document of at most 500 pages. The existing 25 MB file, image, word-count, worker timeout, and extraction-output limits remain in place. Original page numbers remain in field confidence and source previews.
- Material plans first use selectable text. Pages containing recognized other-course codes and no enrolled-course codes do not render previews or run OCR. Pages without recognized codes remain on the extraction path. Relevant text pages use previews bounded to 1200 pixels and avoid timetable color-region analysis. Timetable rendering and color geometry retain their previous path.
- Scanned plans and screenshots use a raster bounded to 3600 pixels on the longest edge and at most 3x scaling. Continuous gray rules can establish table geometry, avoiding the previous black-only threshold and scattered-text false rules. Rule removal erases only detected pixels instead of cutting a halo from nearby letters. The source preview remains untouched.
- A detected ECU table with exactly 12 columns gets an additional English course-name-column OCR pass. Replacement words retain original coordinates, engine scores, and page provenance. Empty refinement retains the initial words. Other layouts retain the regular parser and review flow; no catalog, guessed names, fuzzy course-code correction, or remote OCR is added.
- Multiline names follow reading order within their column. Footer text below a course row cannot masquerade as a numeric column header and erase its name. Later OCR duplicates cannot overwrite names read from selectable PDF text or entered manually. A plan with no matching rows gets an actionable explanation; optional-plan failures include the safe reason and retain the timetable for review. Resolved missing-name warnings are removed.
- OCR progress follows the current page, not the first page that initialized the worker. Cancellation releases PDF pages/canvases and terminates the OCR worker once. PDF page-selection errors keep their actionable wording.

## Student guidance

- Help & getting started is available from the desktop/mobile header, the named footer button, and the existing help shortcut. Today has a compact, reopenable guide, including empty and demo workspaces.
- The guide covers setup/review, attendance and corrections, notes/topics, Planner assignments/exams/tasks, study sessions, Progress, backup transfer between browsers/devices, and offline import preparation.
- Attendance guidance reflects the actual grace period and automatic-missed preference. It explains present/missed/excused percentage rules, manual overrides, correction and clearing, and that check-ins stay personal and do not submit university attendance.
- The check-in dialog explains that the suggested arrival for a past date is the scheduled start and should be corrected to the real arrival. Schedule explains selecting classes and navigating to past weeks. Existing attendance controls and calculations are preserved.
- The setup instructions recommend the original selectable PDF, relevant semester pages, and full-resolution cropped screenshots with code/name columns and table edges. English OCR and Arabic transcription limits are explicit.

## Verification

- Baseline: 139 tests passed. Final: 161 tests across 18 files, including all existing tests and 22 added regressions.
- Full npm run verify passed: lint, strict TypeScript, tests, production/PWA build, both dependency audits (zero vulnerabilities), security scan, repository privacy/allowlist audit, and Pages artifact validation.
- New regressions cover bounded page ranges/provenance, skipping unrelated page rendering, retaining uncertain pages, selectable text versus scans, same-origin worker configuration, worker reuse/current-page progress, multiline column coordinates, empty refinement, cancellation cleanup, gray table rules/source preservation, duplicate-name protection, footer/header separation, unmatched plans, setup help, page-selection forwarding, preference-aware guidance, and real IndexedDB attendance save/correct/clear behavior.
- An anonymous 12-page selectable-text plan rendered 12 previews on the baseline and 1 on the new course-matching path, preserving original page 7. Explicit page selection opened only that page. Wall-clock timings varied with browser background throttling, so no universal speed multiplier is claimed.
- Actual local Tesseract OCR on a synthetic four-course ruled screenshot improved exact course names from 1/4 to 3/4. The new path detected 13 table boundaries and used the separate name-column pass. The remaining Roman numeral II was read as I. The extra recognition pass favors accuracy and may take longer on a single screenshot.
- During the monitored synthetic PDF/OCR extraction, no external HTTP requests or non-GET/HEAD requests occurred. Documents remain local; import workers/language assets remain same-origin. This is scoped observation, not a claim about every browser workflow.
- Desktop and 390-pixel mobile help were inspected. No changes were made to Prism implementation, curated theme definitions, PWA configuration, security headers, dependencies, domain schema, or attendance/storage architecture.
- The final production build passed all 34 local HTTP route/asset checks. A real browser imported an anonymous timetable and selected material-plan page 7, extracted Artificial Intelligence, reviewed and activated the semester, then reloaded offline under service-worker control and opened the new help successfully. The final production workflow reported no console errors.
- Existing hosted baseline passed all 34 HTTP checks. Production upload and postdeployment checks remain for the owner.

The owner's actual plan/screenshot was not attached to this chat. Accuracy on that document is unverified. Blurred, compressed, rotated, unruled, or differently structured plans may still need manual corrections. Review remains required before semester activation.

## Changed files

| Area | Files |
| --- | --- |
| Extractor and selection | src/importer/extract.ts, src/importer/ocr-image.ts, src/importer/page-selection.ts, src/importer/types.ts, src/importer/validation.ts |
| Plan parsing | src/importer/parse.ts |
| Guidance and setup | src/components/WorkflowGuide.tsx, src/components/AttendanceDialog.tsx, src/App.tsx, src/pages/Welcome.tsx, src/pages/Today.tsx, src/pages/Schedule.tsx, src/styles.css |
| Regressions | src/importer/extract.test.ts, src/importer/ocr-image.test.ts, src/importer/page-selection.test.ts, src/importer/importer.test.ts, src/onboarding.test.tsx |
| Release instructions | docs/DEPLOYMENT.md, docs/BETA_RELEASE_PREPARATION.md, docs/FINAL_RELEASE_REVIEW.md, docs/BETA_IMPORT_GUIDANCE.md |

## Redeploy the existing production project

Read-only Wrangler inspection confirmed that project semester-os has no Git provider and its production branch is semester-os-ecu. Deployment 562bf36e is production at source 6731fcd; main deployments are previews. Git source development stays on main. Use the existing repository directory and Node 24:

```powershell
npm.cmd run verify
npx.cmd --yes wrangler@4.146.0 pages deploy dist --project-name=semester-os --branch=semester-os-ecu
npm.cmd run verify:hosted -- https://semester-os-4y6.pages.dev
```

Commit/push the reviewed source separately if desired. Upload only dist, without creating a replacement Pages project. If Wrangler authentication expires, run npx.cmd --yes wrangler@4.146.0 login.

After upload, check the normal beta URL in a fresh browser profile: upload the relevant plan pages, compare names against the original, save/correct a past check-in, open mobile help, and confirm offline reopen after app caching. Existing installations must reconnect and accept the app update; do not erase student workspace data to update the app.
