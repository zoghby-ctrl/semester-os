# Public repository preparation and privacy review — October 2, 2026

The repository is now public at [zoghby-ctrl/semester-os](https://github.com/zoghby-ctrl/semester-os). Local main and origin/main matched the published eff1c2c baseline before this continuation. The working tree was clean, main's hosted CI passed, and GitHub CLI is authenticated as the intended owner. The earlier preparation started without Git metadata; that historical state no longer describes this repository.

The owner explicitly authorized publication of the existing anonymized timetable metadata—course codes/names, rooms, weekdays, times—and labelled demo screenshots. This preserves legacy migration IDs and mappings. It does not authorize publishing original documents, imports, backups, private screenshots or student profiles.

**The source license remains undecided.** No LICENSE is added. Publication does not imply permission to reuse, modify or redistribute the source. This continuation prepares a local onboarding fix and beta release notes; it does not create a tag or release.

## Source boundary

The workspace contains original documents, screenshots, backups, temporary OCR/PDF output and development evidence. These remain local in excluded sources/, screenshots/, output/, tmp/, .playwright-cli/, .wrangler/ and SOURCE_NOTES.md. Generated dependencies, extraction assets, service-worker helpers and dist are rebuilt from the lockfile, not committed.

.gitignore uses default-deny root rules. scripts/repository-files.mjs independently allows only reviewed source/configuration/documentation/icons and seven named screenshots. The audit rejects tracked files outside that boundary even after a forced add.

Eligible text is scanned for private-key and credential patterns, credential assignments, personal absolute paths and non-example emails without printing matched values. The existing upstream glob maintainer contact in package-lock is the narrowly reviewed third-party email exception.

Seven new documentation captures use a blank display name in an isolated empty or labelled-demo profile. Visible text and pixels receive privacy review, supplemented by local OCR. Their exact SHA-256 hashes are checked before staging. The images contain no personal name, student ID, email, account details, local Windows path, source preview, import data or backup data.

These controls apply to the reviewed public files, not every private file remaining on the owner's machine. Pattern scans are not a universal secret-detection or ownership guarantee.

## Reviewed local changes

```sh
npm run verify
npm run repository:manifest
git status --short --branch
git add --pathspec-from-file=output/repository-paths.txt
git diff --cached --stat
git diff --cached --name-only
npm run repository:audit
git diff --cached --check
```

The ignored manifest lists exact paths, sizes and SHA-256 values. Stage only its reviewed entries. Use the owner's existing author name and the verified GitHub noreply address as a repository-local email so the initial public-beta commit does not expose the private configured email. Do not change global Git settings.

The existing origin is https://github.com/zoghby-ctrl/semester-os.git. Commit reviewed changes locally and push normally; do not reinitialize Git, create another repository or force-push.

## Push and first beta release

The source repository already exists. After local validation and commit, the normal push command is:

```sh
git push origin main
```

Inspect the new commit's hosted CI after pushing. Private vulnerability reporting is verified disabled and needs enabling before the first tagged beta. Topics and release-note recommendations are in [beta release preparation](BETA_RELEASE_PREPARATION.md). No release is created without explicit owner authorization.

If the owner later selects a source license, apply its exact text/notices and deliberately add LICENSE to both source boundaries before verification and staging. Do not infer a license from dependency metadata, source availability or a beta tag.

[Release readiness](RELEASE_READINESS.md) · [Deployment](DEPLOYMENT.md) · [Security policy](../SECURITY.md)
