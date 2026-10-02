# Public repository preparation and privacy review — October 2, 2026

The final pass begins from the current application state. The supplied folder had no Git metadata. GitHub CLI is authenticated as the intended owner, zoghby-ctrl; the intended repository semester-os did not exist at inspection.

The owner explicitly authorized publication of the existing anonymized timetable metadata—course codes/names, rooms, weekdays, times—and labelled demo screenshots. This preserves legacy migration IDs and mappings. It does not authorize publishing original documents, imports, backups, private screenshots or student profiles.

The owner separately chose to **leave the source license undecided and hold the public push**. No LICENSE is added, and no GitHub repository is created or pushed in this pass.

## Source boundary

The workspace contains original documents, screenshots, backups, temporary OCR/PDF output and development evidence. These remain local in excluded sources/, screenshots/, output/, tmp/, .playwright-cli/, .wrangler/ and SOURCE_NOTES.md. Generated dependencies, extraction assets, service-worker helpers and dist are rebuilt from the lockfile, not committed.

.gitignore uses default-deny root rules. scripts/repository-files.mjs independently allows only reviewed source/configuration/documentation/icons and seven named screenshots. The audit rejects tracked files outside that boundary even after a forced add.

Eligible text is scanned for private-key and credential patterns, credential assignments, personal absolute paths and non-example emails without printing matched values. The existing upstream glob maintainer contact in package-lock is the narrowly reviewed third-party email exception.

Seven new documentation captures use a blank display name in an isolated empty or labelled-demo profile. Visible text and pixels receive privacy review, supplemented by local OCR. Their exact SHA-256 hashes are checked before staging. The images contain no personal name, student ID, email, account details, local Windows path, source preview, import data or backup data.

These controls apply to the reviewed public files, not every private file remaining on the owner's machine. Pattern scans are not a universal secret-detection or ownership guarantee.

## Reviewed local Git preparation

```sh
npm run verify
npm run repository:manifest
git init --initial-branch=main
git add --pathspec-from-file=output/repository-paths.txt
git diff --cached --stat
git diff --cached --name-only
npm run repository:audit
git diff --cached --check
```

The ignored manifest lists exact paths, sizes and SHA-256 values. Stage only its reviewed entries. Use the owner's existing author name and the verified GitHub noreply address as a repository-local email so the initial public-beta commit does not expose the private configured email. Do not change global Git settings.

The target remote is https://github.com/zoghby-ctrl/semester-os.git. Configuring this remote is local preparation and does not create or publish a GitHub repository.

## Publication remains held

After the owner chooses a license, apply its exact text and any required notices, add LICENSE deliberately to both source allowlists, rerun verification/staging review, and commit it. The following command is prepared for that later authorized step:

```sh
gh repo create zoghby-ctrl/semester-os --public --description "Local-first academic operating system that turns university timetables and study data into a personal semester workspace."
git push -u origin main
```

The prepared local origin already points to this repository. Do not execute publication while the license/public-push decision is held. Enable private vulnerability reporting and inspect the first hosted CI result afterward.

[Release readiness](RELEASE_READINESS.md) · [Deployment](DEPLOYMENT.md) · [Security policy](../SECURITY.md)
