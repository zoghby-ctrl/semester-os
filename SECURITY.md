# Security policy

Semester OS is an accountless, local-first web application. Academic information is intentionally processed and stored on the device in normal operation. This reduces the remote attack surface; it is not a guarantee of complete privacy or security.

## Reporting a vulnerability

Do not disclose a serious vulnerability, exploit, private document, or student backup in a public issue.

The [public repository](https://github.com/zoghby-ctrl/semester-os) exists. On October 2, 2026, GitHub's private vulnerability reporting setting was verified **disabled**. A monitored project contact is also not configured in this source/deployment snapshot. The maintainer needs to enable private reporting before the first tagged beta release.

Once enabled, use **Security → Report a vulnerability** in that repository. Alternatively use a monitored project address if one is configured and shown in Settings → About & legal or the policy pages. Until a private channel is available, do not publish an exploit or sensitive report in a public issue. The public bug/feedback templates are for non-sensitive reports using synthetic data.

Include the affected release/browser, a minimal reproduction, impact, and steps to reproduce using synthetic data. Do not access, modify, or retain another person's academic information. Give the maintainer a reasonable opportunity to investigate and arrange coordinated disclosure. No response SLA or bounty is promised by this draft policy.

## Maintenance

The current Cloudflare beta has no formally declared supported release series. Security fixes should be applied to the current beta, with dependency and deployment checks repeated. Hosted CI has passed for the published baseline. Enable private vulnerability reporting, configure a monitored project contact, and establish a patch/release process before broader beta use.

Run `npm run verify` and repeat the production browser checks in [VALIDATION.md](VALIDATION.md). See [the threat model and security report](docs/SECURITY_REPORT.md) and [deployment requirements](docs/DEPLOYMENT.md). Do not add accounts, telemetry, cloud OCR, or student uploads as a security workaround.
