# Security policy

Semester OS is an accountless, local-first web application. Academic information is intentionally processed and stored on the device in normal operation. This reduces the remote attack surface; it is not a guarantee of complete privacy or security.

## Reporting a vulnerability

Do not disclose a serious vulnerability, exploit, private document, or student backup in a public issue.

When the public repository is created, use its **Security → Report a vulnerability** private reporting feature. The maintainer must enable that feature before public beta. Alternatively use the monitored project address configured for the deployed build, shown in Settings → About & legal and the policy pages. A project address has not been configured in this local source snapshot. If neither private channel is available, wait for a private contact channel rather than publishing an exploit.

Include the affected release/browser, a minimal reproduction, impact, and steps to reproduce using synthetic data. Do not access, modify, or retain another person's academic information. Give the maintainer a reasonable opportunity to investigate and arrange coordinated disclosure. No response SLA or bounty is promised by this draft policy.

## Maintenance

The current Cloudflare beta has no formally declared supported release series. Security fixes should be applied to the current beta, with dependency and deployment checks repeated. Enable private vulnerability reporting when the GitHub repository is published, configure a monitored project contact, and establish a patch/release process before broader beta use.

Run `npm run verify` and repeat the production browser checks in [VALIDATION.md](VALIDATION.md). See [the threat model and security report](docs/SECURITY_REPORT.md) and [deployment requirements](docs/DEPLOYMENT.md). Do not add accounts, telemetry, cloud OCR, or student uploads as a security workaround.
