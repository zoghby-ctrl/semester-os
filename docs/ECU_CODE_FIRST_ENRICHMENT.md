# ECU code-first material-plan enrichment

This is the historical code-first milestone. The subsequent [product generalization pass](PRODUCT_GENERALIZATION.md) preserves canonical enrichment and tightens the scope checks for all entries, adds neutral onboarding/context review, and honors explicit page selections. Its current validation supersedes the counts and context-narrowing behavior recorded below.

October 2, 2026. Local changes on the existing main checkout, HEAD 6731fcd. No commit, push or deployment performed. Earlier beta import performance and student guidance changes remain in the working tree.

## Catalog and source

The source is the existing course metadata in `src/data/legacy-academic.ts`, already used by the ECU legacy/demo semester. Its six complete Computer Science Level 2 / Semester 1 records now live once in `src/data/ecu-catalog.ts`. The legacy demo derives its courses from that same source, preserving course order, names, credits, prerequisites, weekly hours, colors and sessions.

| Code | Canonical name | Credits | Prerequisite |
| --- | --- | --- | --- |
| INF2101 | System Analysis and Design | 3 | None recorded |
| CSC2100 | Data Structures | 3 | CSC1100 — Computer Programming I |
| CSC2104 | Computer Architecture | 3 | BSC1205 — Digital Logic Design |
| CSC2105 | Artificial Intelligence | 3 | BSC1103 — Discrete Mathematics |
| HU2100 | Ethical and Professional Issues in Computing | 2 | None recorded |
| BSC1301 | Mathematics III | 3 | BSC1201 — Mathematics II |

The catalog also indexes those four prerequisite references, supplying their existing names only. Their credits, prerequisites, weekly hours, level and semester remain unknown. Total: 10 indexed codes, six complete course records and four name-only references. This is a bounded local transcription, not a newly verified official or complete ECU curriculum. No additional academic data was invented or fetched.

## Extraction and review behavior

1. ECU course codes supply identity. An exact normalized local catalog match supplies the canonical name and available credits, prerequisite and weekly hours before the material-plan OCR name is considered. The setup flow also applies these defaults when no material plan is uploaded or its extraction fails.
2. Case, whitespace and bounded separator punctuation are normalized. O/0 and I/1 substitutions apply only in alphabetic-prefix/numeric-suffix positions, and only a catalog match permits use of a repaired code. Repaired OCR codes retain low confidence and the original evidence for review. Other substitutions, including S/5, are not attempted.
3. Unknown literally valid codes remain usable and may receive document/OCR metadata through the existing fallback. An unknown repaired code, wildcard or multiple possible code/curriculum matches stays uncertain. An unresolved code blocks activation even if the review checkbox is checked. No fuzzy name or code guessing was added.
4. Explicit Level/Semester context can narrow multiple catalog variants. Conflicting context never forces a match; missing code characters remain uncertain even if context leaves one candidate. The current catalog has no duplicate-code variants; regression fixtures exercise that future case.
5. OCR names are compared with canonical names only to flag anomalies. Disagreeing OCR text appears in bounded evidence/warnings and never overwrites the catalog default. OCR credits/prerequisites/hours likewise cannot replace known catalog fields. Confidence identifies the catalog source and retains the recognized-code score/page; that score is evidence about the code, not a probability that catalog metadata is correct.
6. The extra name-column OCR pass is skipped when all enrolled ECU codes have catalog entries. The initial local OCR pass still reads codes and supporting evidence. Unknown-code fallback retains the earlier OCR path. No further image preprocessing changes were made in this pass.
7. Review labels say “ECU catalog” and explain its limited scope. Every field remains editable. Confirmed manual corrections, including explicit null prerequisites and cleared name/credit values, survive enrichment. Changing a code refreshes its defaults, clears obsolete catalog fields for unknown/name-only entries, updates hour inputs and preserves session links.
8. Activated courses optionally retain field-level metadata provenance. This is additive to the existing semester schema and v2 backup format; old semesters/backups remain accepted. A database export/import regression confirms catalog provenance and manual corrections survive restoration.
9. The generic adapter retains its own code recognition and document metadata behavior. It receives neither ECU catalog values nor ECU O/0 and I/1 repair rules.

## Before/after regression examples

These are synthetic OCR inputs exercised by automated tests, not a new OCR run against the owner's screenshot.

| Recognized code | Before: OCR name input | After: review default |
| --- | --- | --- |
| CSC2105 | Artiflcial lntelllgence | Artificial Intelligence |
| INF2101 | Systern Anaiysis and Deslgn | System Analysis and Design |
| CSC2104 | Cornputer Archltecture | Computer Architecture |
| CSC2105, with footer noise in the code cell | Artiflcial lntelllgence | Artificial Intelligence |
| CSC9999 | Artificial Intelligence | OCR name retained; no catalog credits/prerequisite invented |
| CSC210? | — | Uncertain; no code or canonical name guessed |
| CSC2104/CSC2105 in one OCR cell | — | One uncertain course; no guessed enrollments |
| CSC99O9 | — | Uncertain; not silently converted to an unknown code |
| CSC2IO5 | — | CSC2105 / Artificial Intelligence, low-confidence code evidence and required review |
| CSC2105, generic adapter | Artiflcial lntelllgence | OCR text retained; no ECU metadata |

Other regressions cover normalized separators/case, prefix 1/I repair, overlong/invalid codes, contradictory OCR academic fields, weak code evidence, manual corrections, code changes, name-only references, context ambiguity, editable UI, old-schema acceptance and backup restoration.

## Verification

`npm.cmd run verify` passed: 194 tests across 20 files (previous working-state baseline: 161 tests across 18 files), lint, strict TypeScript, production/PWA build, both dependency audits with zero vulnerabilities, security scan, repository privacy/allowlist audit and Cloudflare Pages artifact checks.

No dependencies, remote OCR/catalog services, PWA settings, security headers, theme definitions or Prism implementation changed. Documents and catalog lookup stay on-device. Existing import review, activation, attendance and backup tests remain passing. The owner's actual screenshot was not supplied for this pass; this work verifies deterministic enrichment given recognized codes, not improved free-form OCR accuracy on that image.

## Exact files changed in this code-first pass

New:

- `src/data/ecu-catalog.ts`
- `src/universities/ecu-codes.ts`
- `src/importer/ecu-enrichment.ts`
- `src/importer/ecu-enrichment.test.ts`
- `src/pages/ecu-review.test.tsx`
- `docs/ECU_CODE_FIRST_ENRICHMENT.md`

Modified (including files already changed by the earlier uncommitted beta pass):

- `src/data/legacy-academic.ts`
- `src/universities/index.ts`
- `src/universities/adapters.test.ts`
- `src/importer/extract.ts`
- `src/importer/extract.test.ts`
- `src/importer/parse.ts`
- `src/importer/importer.test.ts`
- `src/importer/normalize.ts`
- `src/lib/domain.ts`
- `src/lib/db.test.ts`
- `src/pages/Welcome.tsx`
- `docs/BETA_IMPORT_GUIDANCE.md`

These 18 files describe this pass only. The working tree also contains the preceding beta PDF performance and workflow guidance changes documented in BETA_IMPORT_GUIDANCE.md; they were preserved.

## Commit recommendation and redeploy commands

Recommended commit title: `Use ECU course codes for deterministic catalog enrichment`.

Review the earlier uncommitted beta changes separately; several files overlap, so staging every file blindly would combine both passes. This pass is ready for a focused source review and commit; no commit was created automatically.

From the existing repository:

```powershell
npm.cmd run verify
npx.cmd --yes wrangler@4.146.0 pages deploy dist --project-name=semester-os --branch=semester-os-ecu
npm.cmd run verify:hosted -- https://semester-os-4y6.pages.dev
```

The existing project uses `semester-os-ecu` as its production deployment branch; `main` uploads are previews. After deployment, use a fresh browser profile to import an ECU timetable with the three example codes, confirm canonical defaults and editable corrections, and test backup restore/offline reopen. Reconnecting existing installations should accept the normal app update without erasing student data.
