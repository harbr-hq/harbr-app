# Security Policy

## Supported Versions

Harbr is currently pre-release. Security fixes are applied to the latest commit on `main` only.

| Version | Supported |
| ------- | --------- |
| latest (main) | ✅ |
| older builds  | ❌ |

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Report vulnerabilities privately via [GitHub Security Advisories](https://github.com/harbr-hq/harbr/security/advisories/new) — this keeps the details confidential until a fix is available.

Include as much of the following as you can:

- Description of the vulnerability and potential impact
- Steps to reproduce or a proof of concept
- Affected component (Rust daemon, frontend, Tauri layer, config handling)
- Any suggested fixes if you have them

## What to Expect

- **Acknowledgement** within 48 hours
- **Assessment** (accepted / declined / more info needed) within 7 days
- **Fix and disclosure** coordinated with the reporter once a patch is ready

Since Harbr runs locally and talks only to the local Podman socket, the practical attack surface is limited — but auth bypasses, local privilege escalation, and path traversal are all taken seriously.
