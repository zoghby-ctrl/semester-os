# Release readiness — October 2, 2026

**Status: live Cloudflare beta and public GitHub repository; first-run navigation fix prepared locally; source license undecided.** This is a beta, not a production-readiness or legal/security certification. No tag or GitHub release is created.

The existing [beta](https://semester-os-4y6.pages.dev) passes all 34 hosted route/asset checks, including the legal routes. The [public repository](https://github.com/zoghby-ctrl/semester-os) exists and main's published baseline CI passed. October 1 deployment/Git omissions are historical and superseded by this review.

## Current verified baseline and polish

The original state was independently rechecked: **118 tests in 13 files**, lint, strict TypeScript, production/PWA build, production/full dependency audits with zero vulnerabilities, source/build security scan, repository privacy scan, and Pages artifact checks all passed.

The final pass adds five meaningful motion/routing regressions, retaining all original tests: **123 tests in 14 files**. Midnight, Campus, and Focus are polished within the existing shared renderer. Prism's renderer, shaders, meteor engine and CSS remain byte-for-byte unchanged. Importer, database, backup and legacy conversion architecture remain unchanged.

All 13 curated themes have desktop/mobile visual captures and layout/motion checks at 1440/900/390/320 pixels. Reduced-motion checks, timer halo, local production PWA/offline and the Pages runtime are recorded in [the theme-polish review](FINAL_RELEASE_REVIEW.md) and [validation](../VALIDATION.md). The later onboarding tests and responsive checks are recorded in [beta release preparation](BETA_RELEASE_PREPARATION.md). Physical-device observations are separate from browser emulation.

## Public repository privacy

The owner explicitly authorized the existing anonymized timetable metadata and labelled demo screenshots on October 2. Course codes/names, rooms, weekdays and times remain available for legacy compatibility and the optional demo. Original student documents, imports, backups and private captures remain excluded.

Public documentation screenshots are refreshed with a blank display name and visually reviewed. They must contain no personal name, student ID, email, account details, local Windows path or private document. Exact image hashes gate subsequent staging. The public source allowlist also excludes original documents, OCR temporaries, local environment files, logs, generated extraction assets, build output and dependencies.

## Remaining release gates

| Gate | Status / next action |
| --- | --- |
| Source license | No LICENSE is selected or added. Public source availability does not imply permission to reuse, modify or redistribute. Resolve or explicitly record this status before authorizing a tagged beta. |
| Onboarding fix publication | Push the reviewed local fix, inspect its own CI result, then redeploy its verified dist to the existing semester-os project. |
| Hosted legal routes | Resolved: the current beta passes all 34 HTTP route/asset checks. Repeat the hosted checks after each redeployment. |
| Public operator/contact | Configure a monitored public VITE_PROJECT_CONTACT and identify the operator before inviting a broader audience. |
| Legal review | Privacy Policy and Terms remain drafts requiring qualified review; no attorney review is claimed. |
| Private security reports / hosted CI | Main's published baseline CI passed. Private vulnerability reporting is currently disabled; enable it before a tagged beta and check the new fix's CI after push. |
| v0.1.0-beta.1 authorization | Release notes are drafted. No tag/release is created; explicit owner release authorization is required. |
| Physical-device and student beta | Check Android/iOS install/reopen/update/offline, representative browsers, battery/GPU, slower-device OCR and storage loss; run the unassisted ECU student acceptance flow. |
| Optional semesteros.is-a.dev alias | Pending is-a.dev PR merge and Cloudflare custom-domain setup. Do not advertise it as production. |

[Deployment](DEPLOYMENT.md) · [Repository review](REPOSITORY_REVIEW.md) · [Student acceptance script](ECU_BETA_TEST.md) · [Security policy](../SECURITY.md)
