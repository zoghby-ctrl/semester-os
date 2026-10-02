# Release readiness — October 2, 2026

**Status: live Cloudflare beta; final local polish prepared; public source push held by the owner pending a license decision.** This is a beta, not a production-readiness or legal/security certification.

The existing [beta](https://semester-os-4y6.pages.dev) is reachable. October 1 reports recorded deployment preparation before the later deployment; their historical “not deployed” statements are superseded by this review.

## Current verified baseline and polish

The original state was independently rechecked: **118 tests in 13 files**, lint, strict TypeScript, production/PWA build, production/full dependency audits with zero vulnerabilities, source/build security scan, repository privacy scan, and Pages artifact checks all passed.

The final pass adds five meaningful motion/routing regressions, retaining all original tests: **123 tests in 14 files**. Midnight, Campus, and Focus are polished within the existing shared renderer. Prism's renderer, shaders, meteor engine and CSS remain byte-for-byte unchanged. Importer, database, backup and legacy conversion architecture remain unchanged.

All 13 curated themes have desktop/mobile visual captures and layout/motion checks at 1440/900/390/320 pixels. Reduced-motion checks, timer halo, local production PWA/offline and the Pages runtime are recorded in [the final release review](FINAL_RELEASE_REVIEW.md) and [validation](../VALIDATION.md). Physical-device observations are separate from browser emulation.

## Public repository privacy

The owner explicitly authorized the existing anonymized timetable metadata and labelled demo screenshots on October 2. Course codes/names, rooms, weekdays and times remain available for legacy compatibility and the optional demo. Original student documents, imports, backups and private captures remain excluded.

Public documentation screenshots are refreshed with a blank display name and visually reviewed. They must contain no personal name, student ID, email, account details, local Windows path or private document. Exact image hashes gate subsequent staging. The public source allowlist also excludes original documents, OCR temporaries, local environment files, logs, generated extraction assets, build output and dependencies.

## Remaining release gates

| Gate | Status / next action |
| --- | --- |
| License / public GitHub push | Owner chose to keep the license undecided and hold the public push. No LICENSE is added. Local main is prepared; publication waits for an explicit decision. |
| Existing beta redeployment | Upload the verified dist to the existing semester-os project. No new Pages project is needed. |
| Hosted legal routes | Existing beta returns 308 then 404 for the legal paths. Canonical-root proxy fix passes 34 checks in the local Pages runtime; redeploy and repeat the hosted check. |
| Public operator/contact | Configure a monitored public VITE_PROJECT_CONTACT and identify the operator before inviting a broader audience. |
| Legal review | Privacy Policy and Terms remain drafts requiring qualified review; no attorney review is claimed. |
| Private security reports / hosted CI | Enable GitHub private vulnerability reporting and run hosted CI once the repository is published. CLI authentication alone does not establish either. |
| Physical-device and student beta | Check Android/iOS install/reopen/update/offline, representative browsers, battery/GPU, slower-device OCR and storage loss; run the unassisted ECU student acceptance flow. |
| Optional semesteros.is-a.dev alias | Pending is-a.dev PR merge and Cloudflare custom-domain setup. Do not advertise it as production. |

[Deployment](DEPLOYMENT.md) · [Repository review](REPOSITORY_REVIEW.md) · [Student acceptance script](ECU_BETA_TEST.md) · [Security policy](../SECURITY.md)