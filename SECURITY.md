# Security Policy

## Overview

The Quantum Vorvex team takes the security of our hotel management system seriously. We appreciate the efforts of security researchers and the broader community in helping us identify and address vulnerabilities responsibly. This document outlines our security policy, how to report vulnerabilities, and what you can expect from us.

---

## Supported Versions

Only the versions listed below are actively receiving security updates. If you are running an unsupported version, please upgrade before reporting a vulnerability.

| Version | Supported          | Notes                        |
|---------|--------------------|------------------------------|
| 1.0.x   | Yes                | Current stable release       |
| < 1.0   | No                 | Pre-release / development    |

---

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues, pull requests, or community forums.**

### How to Report

Send your report to:

**Email:** security@quantumvorvex.com

Use the subject line: `[SECURITY] <Short description of vulnerability>`

### PGP Encryption (Recommended for sensitive reports)

We strongly encourage you to encrypt your report using our PGP public key to protect sensitive details in transit.

```
-----BEGIN PGP PUBLIC KEY BLOCK-----
<PLACEHOLDER — PGP public key will be added here before public release>
-----END PGP PUBLIC KEY BLOCK-----
```

*Key fingerprint: `XXXX XXXX XXXX XXXX XXXX  XXXX XXXX XXXX XXXX XXXX` (placeholder)*

### What to Include in Your Report

To help us triage and reproduce the issue efficiently, please provide:

1. **Description** — A clear summary of the vulnerability and its potential impact.
2. **Affected component** — Frontend, backend API, authentication layer, database layer, etc.
3. **Steps to reproduce** — Detailed, numbered steps that allow us to replicate the issue.
4. **Proof of concept** — Code snippets, screenshots, or HTTP request/response dumps (sanitize any real user data).
5. **Suggested fix** — Optional but appreciated.
6. **Your contact details** — So we can keep you informed and credit you appropriately.

---

## Response Timeline

We are committed to handling security reports in a timely and transparent manner.

| Milestone                          | Target Timeline          |
|------------------------------------|--------------------------|
| Acknowledgement of report          | < 48 hours               |
| Initial triage and severity rating | < 7 days                 |
| Fix deployed for Critical severity | < 24 hours after triage  |
| Fix deployed for High severity     | < 7 days after triage    |
| Fix deployed for Medium severity   | < 30 days after triage   |
| Fix deployed for Low severity      | Next scheduled release   |
| Public disclosure (coordinated)    | After fix is deployed    |

We will keep you informed at each stage. If you do not receive an acknowledgement within 48 hours, please follow up to ensure your email was received.

---

## Scope

### In Scope

The following systems and components are in scope for responsible disclosure:

- **Backend API** — `server/` (Node.js + Express + Prisma)
- **Frontend SPA** — `client/` (React)
- **Authentication system** — JWT-based login, session management
- **Admin dashboard** — Role-based access control, privilege boundaries
- **File upload functionality** — Upload processing and storage
- **API endpoints** — All `/api/v1/` routes
- **Database access layer** — Prisma ORM queries, data exposure

### Out of Scope

The following are explicitly **out of scope** and reports about them will not be accepted:

- Vulnerabilities in third-party services or libraries that are already publicly known and have upstream fixes pending
- Denial of Service (DoS) attacks or resource exhaustion attacks
- Social engineering attacks against Quantum Vorvex employees or users
- Physical security issues
- Vulnerabilities requiring physical access to a device
- Issues on non-production, staging, or development environments not directly linked to a production vulnerability
- Clickjacking on pages with no sensitive actions
- Missing security headers that do not lead to a demonstrable vulnerability
- Self-XSS (where the attacker must be the victim)
- Theoretical vulnerabilities without a working proof of concept
- Rate limiting on non-authentication endpoints unless abuse is demonstrable
- Brute force attacks that are already mitigated by existing controls

---

## What NOT to Do

When researching and reporting vulnerabilities, you **must not**:

- Perform Denial of Service (DoS) or Distributed Denial of Service (DDoS) attacks against any Quantum Vorvex system
- Access, download, modify, or delete data belonging to any user account other than your own test account
- Execute automated scanners against production systems without prior written permission
- Attempt social engineering, phishing, or physical intrusion
- Exploit a vulnerability beyond what is necessary to confirm its existence
- Share or publicly disclose a vulnerability before we have had a reasonable opportunity to fix it
- Submit fraudulent reports to manipulate a bug bounty program
- Violate any applicable laws or regulations during your research

Violations of these rules may result in disqualification from any recognition program and may be reported to relevant authorities.

---

## Safe Harbor

Quantum Vorvex supports responsible security research. If you follow the guidelines in this policy when researching and reporting a vulnerability, we will:

- Consider your activities to be authorized under our systems and not pursue civil or criminal action against you
- Work with you to understand and promptly resolve the issue
- Not pursue or support any legal action against you related to your research

This safe harbor applies only to security research conducted in good faith and in accordance with this policy. It does not apply to activities that violate applicable law or the restrictions listed in the "What NOT to Do" section above.

---

## Bug Bounty Program

Quantum Vorvex does **not currently offer a paid bug bounty program**.

We do offer public recognition in our Hall of Fame (see below) for valid, in-scope vulnerability reports. We are evaluating a formal bug bounty program for a future release.

---

## Hall of Fame

We sincerely thank the following researchers for their responsible disclosures. Your contributions make Quantum Vorvex more secure for everyone.

| Researcher | Date Reported | Vulnerability Category | Severity |
|------------|---------------|------------------------|----------|
| *(empty — be the first!)* | — | — | — |

If you have reported a vulnerability and would like to be added to this list (or remain anonymous), please let us know in your report.

---

## Contact

| Purpose                          | Contact                            |
|----------------------------------|------------------------------------|
| Security vulnerabilities         | security@quantumvorvex.com         |
| General enquiries                | contact@quantumvorvex.com          |
| Legal / compliance               | legal@quantumvorvex.com            |

---

*This policy was last reviewed on 2026-04-06 and applies to Quantum Vorvex v1.0.0.*
