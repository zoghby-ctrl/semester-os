# Cloudflare Pages beta and redeployment

The existing project is **semester-os**. Its current [live beta](https://semester-os-4y6.pages.dev) remains the beta address. This pass prepares a new artifact; it does not create another project or upload automatically.

The optional semesteros.is-a.dev alias is pending its is-a.dev PR merge and Cloudflare custom-domain setup. It must not be treated as production until both are complete.

## Existing-project redeployment

Use Node 24 and the committed lockfile. Build and validate before uploading **only dist**:

```sh
npm ci
npm run verify
npx --yes wrangler@4.146.0 pages deploy dist --project-name=semester-os --branch=main
npm run verify:hosted -- https://semester-os-4y6.pages.dev
```

This is the exact redeployment command for the existing project. Wrangler Direct Upload supports --project-name and --branch; see [Cloudflare's deployment instructions](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/). If authentication expires, run npx --yes wrangler@4.146.0 login and sign into the intended existing account. Do not paste credentials into source or chat.

The source repository is now public at [zoghby-ctrl/semester-os](https://github.com/zoghby-ctrl/semester-os). Direct Upload remains the deployment method for the existing Pages project. Source availability does not change the undecided license. Do not convert project modes or create a replacement deployment target for this polish.

| Build setting | Value |
| --- | --- |
| Node | 24, matching .node-version and CI |
| Build | npm run build; use npm run verify for release gates |
| Output | dist |
| Production branch | main |
| Optional browser configuration | VITE_PROJECT_CONTACT: public monitored project address |
| Functions, backend, student database, analytics | None |

## Legal-route correction

Read-only inspection on October 2 found that the deployed /privacy and /terms requests returned 308 redirects to trailing-slash paths that returned 404. Other tested route, header, metadata and extraction-integrity checks passed.

The deployed _redirects now proxies both legal URL forms to the canonical root, rather than index.html, avoiding Pages' HTML-path normalization. The current hosted build passes all 34 HTTP route/asset checks, including both legal URL forms, aliases, missing-asset 404s, headers and extraction-asset integrity. The earlier legal-route fault is resolved on the live edge. The new onboarding UX changes still need their own redeployment after the local commit is pushed.

The app's hash router, service-worker architecture and academic storage are unchanged. A top-level 404.html still prevents missing JavaScript, PDF workers and OCR/WASM assets from becoming application HTML. No broad SPA rewrite is added. See [Pages routing behavior](https://developers.cloudflare.com/pages/configuration/serving-pages/) and [relative proxy rules](https://developers.cloudflare.com/pages/configuration/redirects/).

## Headers, assets and updates

The postbuild script generates the existing CSP, nosniff, no-referrer, Permissions-Policy, frame denial and HSTS. Dynamic CSS and local WASM compilation remain the documented allowances. No broad JavaScript evaluation or inline-script permission is added.

Hashed assets remain immutable. HTML/legal pages/manifest revalidate; service workers use no-store; vendor extraction data uses no-cache, no-transform and explicit MIME types. Pages artifact validation checks allowed files, size/count limits, fonts/icons/manifest, workers, WASM and language hashes.

Approximately 24 MB of extraction tools can be prepared in Settings → Data & backup. Ordinary shell installation does not prepare offline OCR. Documents and academic records are processed locally; the hosting account may still retain ordinary asset-request logs.

Publish complete builds atomically. Test the update banner and offline reopen afterward. Never erase student IndexedDB to force adoption; offline clients need to reconnect to receive fixes.

## Verification scope

The local production browser verifies themes, layouts, core routes, public policies, service-worker control and offline reload. The hosted verifier checks HTTPS headers/HSTS, legal routes, aliases, missing assets, metadata and worker/language integrity; it does not certify native installation or all-device behavior.

After redeployment, use a fresh profile to check public legal paths, updates and offline core pages, then complete physical Android/iOS install/reopen/update checks and the [ECU student beta flow](ECU_BETA_TEST.md). Operator/contact and draft legal review remain [release gates](RELEASE_READINESS.md).
