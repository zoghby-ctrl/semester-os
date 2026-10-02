# Motion milestone — source and deployment review

> Historical October 1 record. The October 2 continuation verified the 118-test baseline, confirmed the live Cloudflare beta, obtained permission for anonymized demo metadata, refreshed screenshots without personal names/details, and prepared a local main commit. The owner left the license undecided and held the public push. See [FINAL_RELEASE_REVIEW.md](FINAL_RELEASE_REVIEW.md) and [the current repository review](REPOSITORY_REVIEW.md) for the current state.

This document records the source/privacy and Cloudflare preparation portion of the October 1, 2026 continuation. Final motion implementation, cumulative test counts, desktop/mobile results, performance and cleanup evidence are recorded separately in [MOTION_MILESTONE.md](MOTION_MILESTONE.md) after the final root verification. No final test count is asserted here.

## Original baseline independently verified

`npm run verify` was started before motion/deployment edits and completed successfully against the original repository state:

| Check | Verified original result |
| --- | --- |
| ESLint | Passed |
| Strict TypeScript | Passed |
| Unit suite | 93 tests passed in 10 files |
| Vite production build | Passed |
| PWA service-worker generation | Passed |
| Production dependency audit | Zero reported vulnerabilities |
| Full dependency audit | Zero reported vulnerabilities |
| Source/build security pattern scan | Passed |

The real supplied ECU 6-course/11-session import, onboarding, attendance, recovery/offline and prior responsive claims are documented in the original local-beta evidence. Passing the original suite does not establish hosted behavior or physical-device usability. No tests were removed for deployment preparation.

## Git and source privacy

There is no `.git` in this project or its parents. The GitHub CLI is authenticated, but no local Git initialization, commit, remote creation, or push was performed. No public source repository or source license was selected. Cloudflare can use a reviewed private repository; public visibility requires owner approval.

The workspace contains original academic PDFs/images, screenshots of private imports, exported backups, temporary OCR/PDF images, logs/browser snapshots, and a migration ZIP. `sources/`, `screenshots/`, `tmp/`, `output/`, `.playwright-cli/`, and `SOURCE_NOTES.md` remain excluded. Generated dependencies/vendor assets/service-worker helpers are recreated from the lockfile.

`.gitignore` now uses root default-deny rules. The independent `scripts/repository-files.mjs` allowlist protects against accidental or forced staging of excluded files. `scripts/repository-audit.mjs` scans eligible text for credential/private-key patterns, credential assignments, personal absolute paths, and private email patterns without exposing values. Seven documentation screenshots were visually inspected as empty/demo/public-policy pages and locked to reviewed SHA-256 values. The observed upstream glob deprecation maintainer contact is a narrow lockfile email exception; other checks still apply.

`npm run repository:manifest` writes exact eligible paths, sizes and SHA-256 hashes to ignored `output/repository-review.json`, plus `output/repository-paths.txt` for explicit Git staging. Regenerate both after all final modifications, review every staged path, and rerun the audit after initialization. The full [repository review procedure](REPOSITORY_REVIEW.md) preserves ownership decisions and avoids invented commit identity.

The preserved `src/data/legacy-academic.ts` demo/migration fixture contains rooms, times and course details transcribed from the owner-provided timetable. It uses the explicit Demo Student identity and is not a fresh student's automatic data, but permission to share those schedule details must be confirmed before an externally accessible beta or public source repository. The allowed demo screenshots display some of the same schedule. Neither source patterns nor anonymized names establish sharing permission. No original private source document is included in the deployment allowlist.

## Cloudflare configuration prepared

| Configuration | Prepared value |
| --- | --- |
| Runtime | Node 24 via `.node-version`, matching CI |
| App build | `npm run build` |
| Output | `dist` |
| Gated Pages Git-build command | `npm ci && npm run verify` |
| Custom-install environment | `SKIP_DEPENDENCY_INSTALL=1` for that command |
| Backend/Functions/bindings | None |
| Accounts/database/analytics | None |
| Initial domain | Owner-confirmed `*.pages.dev` sufficient |

Package scripts and Vite output were inspected rather than assumed. Build preparation recreates same-origin PDF/OCR workers, WASM variants, English language data and their hash manifest. Postbuild emits `_headers`, `_redirects`, and a top-level `404.html`. The preserved app router uses hash routes; readable pathname aliases such as `/onboarding` redirect to them, and `/privacy`/`/terms` have narrow HTML rewrites. The top-level 404 prevents missing script/worker/WASM requests from silently receiving the SPA shell.

`npm run verify:pages` checks required shell/PWA/worker/vendor assets, manifest icons, vendor bytes/hashes, explicit routing, prepared security policy, absence of unreviewed output, Pages file-count/size limits, and disabled source maps. The inspected artifact contained 53 files with a largest file of 3.72 MiB; this is the preparation artifact, not the final motion build's asserted size/count. In an isolated copy, an unreviewed private-export file and corrupt OCR language data were rejected; the restored copy passed. Production `dist/` was unchanged by those negative checks.

## Security headers and local HTTP evidence

The existing policy remains the source of CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, and framing denial. CSP preserves same-origin scripts/workers/assets/fonts/network, the narrow OCR `wasm-unsafe-eval` allowance, and documented dynamic inline CSS; it does not enable JavaScript eval or inline scripts. HTTPS responses are prepared for one-year HSTS without subdomain/preload assumptions. Beta indexing is discouraged with `X-Robots-Tag: noindex`.

Pages cache rules now avoid overlapping Cache-Control values: hashed assets are immutable, HTML/manifest revalidate, service-worker scripts use `no-store`, and vendor data revalidate with `no-transform`. Local PDF `.mjs`, WASM and gzip language data have explicit MIME rules. No generic broad CSP or SPA redirect was added.

The read-only `npm run verify:hosted -- --local http://127.0.0.1:4175` check passed **34 local routes/assets** on the production server. It verified legal routes, onboarding/app aliases, missing-file 404s, security policy, worker cache rules, manifest/icons, and the complete PDF/OCR asset hashes/MIME. Evidence lives in ignored `output/hosted-verification.json`. This is local HTTP evidence: it establishes neither public HTTPS/HSTS/CDN behavior nor hosted browser/PWA installation/offline operation.

Application validation/recovery, browser CSP/permissions/storage boundaries, and Cloudflare edge HTTPS/CDN/DDoS protections remain separate responsibilities. React contains no DDoS implementation. No new backend or telemetry was introduced by preparation.

## Owner authorization and exact next steps

Wrangler is not configured locally, and no Cloudflare API token/account ID was available at inspection. No authorization dialog or upload was initiated. The owner must authorize the intended Cloudflare account:

```sh
npx --yes wrangler@4.146.0 login
npx --yes wrangler@4.146.0 whoami
```

Complete the browser OAuth authorization, confirm the intended owning account if several are available, and choose a Pages project name. The pinned version was checked against the npm registry during preparation. No credentials need to be pasted into chat.

After authorization, demo-sharing/public-contact decisions and final verification, the prepared Direct Upload commands are:

```sh
npm run verify
npx --yes wrangler@4.146.0 pages project create OWNER_CHOSEN_PROJECT --production-branch=main
npx --yes wrangler@4.146.0 pages deploy dist --project-name=OWNER_CHOSEN_PROJECT --branch=main
npm run verify:hosted -- https://OWNER_CONFIRMED_PROJECT.pages.dev
```

Replace placeholders with owner-confirmed values. Deploy only `dist`. Do not infer a successful deployment from CLI preparation: verify the returned URL over real HTTPS. Git integration is an alternative using a reviewed private repository and repository-scoped Cloudflare GitHub authorization. Choose the project mode deliberately because Direct Upload cannot later switch to Git integration within the same project. Full host/browser checks and primary Cloudflare references are in [DEPLOYMENT.md](DEPLOYMENT.md).

## Remaining release gates

- Final cumulative motion build/tests/lint/TypeScript/security/audit and desktop/mobile/cleanup evidence.
- Operator identity, monitored public contact, source license/dependency notices, and qualified Privacy Policy/Terms review.
- Confirmed permission to share the existing owner-derived demo schedule; owner approval before any public source repository.
- Real Cloudflare authorization/deployment and a reachable HTTPS beta URL.
- Actual hosted CI run, HTTP/TLS/security-header checks, browser workflow/CSP checks, hosted PWA/offline/backup/OCR verification.
- Physical Android and physical iOS install/reopen/update/offline and GPU/battery testing.
- Independent ECU student usability study using [ECU_BETA_TEST.md](ECU_BETA_TEST.md).

No real HTTPS deployment, hosted CI, hosted PWA, physical-device result or external-student pass is marked complete. Keep these gates explicit in [RELEASE_READINESS.md](RELEASE_READINESS.md).
