# Threat Model — Quantum Vorvex Hotel Management System

**Document Version:** 1.0.0
**Last Updated:** 2026-04-06
**Author:** Security Engineering
**Review Cycle:** Quarterly or after significant architectural changes
**Classification:** INTERNAL

---

## Executive Summary

This document presents the STRIDE-based threat model for the Quantum Vorvex hotel management system. The analysis covers the React single-page application frontend, Express REST API backend, SQLite database, JWT-based authentication subsystem, file upload functionality, and the administrative dashboard.

A total of **15 threats** have been identified across all STRIDE categories. Of these:

- **3 threats** are rated Critical risk
- **5 threats** are rated High risk
- **5 threats** are rated Medium risk
- **2 threats** are rated Low risk

The highest-priority mitigations are: enforcing parameterised queries via the Prisma ORM, rotating JWT secrets regularly with a strong minimum entropy requirement, validating and sandboxing all file uploads, and applying a strict Content Security Policy on the frontend.

All identified mitigations are either already implemented or tracked as backlog items. Residual risk has been accepted by the engineering lead pending remediation timelines noted in the action items section.

---

## Architecture Overview

### Components

| Component          | Technology                      | Trust Level  |
|--------------------|---------------------------------|--------------|
| Frontend SPA       | React 18, Vite, Axios           | Untrusted    |
| Backend API        | Node.js 20, Express 4, Prisma 5 | Semi-trusted |
| Database           | SQLite (via Prisma ORM)         | Trusted      |
| Authentication     | JWT (access + refresh tokens)   | Semi-trusted |
| File Upload Store  | Local filesystem / `uploads/`   | Semi-trusted |
| Admin Dashboard    | React (role-gated routes)       | Privileged   |
| Nginx Reverse Proxy| Nginx (optional, production)    | Trusted      |

### Architecture Diagram (ASCII)

```
┌──────────────────────────────────────────────────────────────────────┐
│                        PUBLIC INTERNET (Untrusted)                   │
└───────────────────────────────┬──────────────────────────────────────┘
                                │ HTTPS (TLS 1.2+)
                    ┌───────────▼──────────────┐
                    │    Nginx Reverse Proxy    │
                    │   (TLS termination,       │
                    │    rate limiting)         │
                    └───────────┬──────────────┘
                                │
          ┌─────────────────────┼──────────────────────┐
          │                     │                      │
┌─────────▼──────────┐ ┌────────▼────────┐  ┌─────────▼──────────┐
│   React SPA        │ │  Express API    │  │   Admin Dashboard  │
│   (Browser)        │ │  :5000          │  │   (React, /admin)  │
│                    │ │                 │  │                    │
│  - Auth pages      │ │  - /api/v1/*    │  │  - Staff mgmt      │
│  - Room booking    │ │  - JWT middleware│  │  - Reports         │
│  - Guest portal    │ │  - Prisma ORM   │  │  - Settings        │
└────────────────────┘ └────────┬────────┘  └────────────────────┘
                                │
                    ┌───────────▼──────────────┐
                    │      SQLite Database      │
                    │   (hotel_management.db)   │
                    │                          │
                    │  guests, rooms,           │
                    │  bookings, users,         │
                    │  staff                    │
                    └──────────────────────────┘
                                │
                    ┌───────────▼──────────────┐
                    │   Local Filesystem        │
                    │   /uploads               │
                    │   (guest ID docs,         │
                    │    profile images)        │
                    └──────────────────────────┘
```

---

## Trust Boundaries

| Boundary ID | Description                                                      | Controls                                  |
|-------------|------------------------------------------------------------------|-------------------------------------------|
| TB-01       | Internet → Nginx (public perimeter)                              | TLS, firewall rules, DDoS protection      |
| TB-02       | Browser → Express API (authenticated API calls)                  | JWT validation, CORS policy               |
| TB-03       | Express API → SQLite database (internal data access)             | Parameterised queries (Prisma ORM)        |
| TB-04       | Express API → Filesystem (file uploads)                          | MIME validation, path sanitisation        |
| TB-05       | Regular user → Admin dashboard routes                            | Role-based access control (RBAC)          |
| TB-06       | Staff user → Admin-only API endpoints                            | Middleware role checks, JWT claims        |

---

## STRIDE Threat Table

| ID    | STRIDE Category        | Component          | Attack Vector                                                                                     | Likelihood | Impact   | Risk Score | Mitigation                                                                                                                         | Residual Risk |
|-------|------------------------|--------------------|---------------------------------------------------------------------------------------------------|------------|----------|------------|------------------------------------------------------------------------------------------------------------------------------------|---------------|
| T-001 | Injection              | Database / API     | Attacker crafts malicious SQL via user-controlled input fields (search, filter params) if raw SQL is used instead of ORM | M          | Critical | HIGH       | Use Prisma ORM exclusively with parameterised queries. Ban raw `$queryRawUnsafe`. Add semgrep rule for SQL concatenation. Enforce in CI. | Low           |
| T-002 | Spoofing               | Authentication     | Attacker forges a JWT by guessing or brute-forcing a weak secret, impersonating any user including admins | M          | Critical | HIGH       | Enforce minimum 256-bit random JWT secret. Store in env var. Rotate quarterly. Use RS256 (asymmetric) in production.               | Low           |
| T-003 | Elevation of Privilege | Admin Dashboard    | Authenticated low-privilege user manually navigates to `/admin` routes or calls admin API endpoints that lack server-side role checks | H          | Critical | CRITICAL   | Every admin route must validate `req.user.role === 'ADMIN'` server-side. Do not rely on frontend route guards alone.               | Medium        |
| T-004 | Denial of Service      | API / Express      | Attacker floods `/api/v1/auth/login` or other unauthenticated endpoints with requests, exhausting CPU or DB connections | H          | High     | HIGH       | Apply `express-rate-limit` on all routes, stricter limits on auth endpoints (e.g. 10 req/15 min per IP). Add Nginx rate limiting as outer layer. | Low           |
| T-005 | Tampering              | Logging / Audit    | Attacker with partial server access modifies log files to erase evidence of intrusion or data access | L          | High     | MEDIUM     | Ship logs to an external, append-only log aggregator (e.g. Loki, Papertrail). Restrict write access to log files on the host.      | Low           |
| T-006 | Information Disclosure | API Responses      | API returns stack traces, Prisma error objects, or full error messages containing schema/path info in production | H          | Medium   | MEDIUM     | Use a global Express error handler that strips internals in production. Never expose `err.stack` or Prisma error details to clients. | Low           |
| T-007 | Spoofing               | Frontend / API     | Cross-Site Request Forgery — attacker tricks an authenticated admin into performing state-changing actions via a malicious third-party page | M          | High     | HIGH       | Validate `Origin`/`Referer` headers. Use `SameSite=Strict` on cookies. If using cookies for auth, add CSRF token. JWT in `Authorization` header is inherently CSRF-safe. | Low           |
| T-008 | Elevation of Privilege | File Upload        | Attacker uploads a `.js`, `.sh`, or other executable file disguised as an image/document. If the server executes or serves it with wrong MIME type, Remote Code Execution is possible | M          | Critical | CRITICAL   | Validate MIME type via `file-type` (magic bytes), not extension. Allowlist: `image/jpeg`, `image/png`, `application/pdf`. Store uploads outside webroot. Never execute uploaded files. | Medium        |
| T-009 | Spoofing               | Authentication     | Brute force or credential stuffing attack against `/api/v1/auth/login` using leaked credential lists | H          | High     | HIGH       | Rate limiting (T-004 mitigation). Account lockout after N failed attempts. Consider CAPTCHA on frontend. Log and alert on failure spike. | Medium        |
| T-010 | Tampering              | Frontend SPA       | Reflected or stored XSS allows attacker to inject scripts into the DOM, stealing JWT tokens from `localStorage` or performing actions as the victim | M          | High     | HIGH       | Strict Content Security Policy (CSP). React's JSX auto-escapes most content. Avoid `dangerouslySetInnerHTML`. Sanitise all user-supplied HTML. Store JWT in httpOnly cookie if possible. | Medium        |
| T-011 | Elevation of Privilege | API — Bookings     | Insecure Direct Object Reference — authenticated user modifies `bookingId` or `guestId` in request to access or modify another guest's data | H          | High     | HIGH       | Every data access query must include `WHERE userId = req.user.id`. Never trust client-supplied IDs without ownership verification.  | Low           |
| T-012 | Information Disclosure | Authentication     | JWT secret stored in source code, `.env` committed to Git, or in plaintext config files, allowing anyone with repo access to forge tokens | M          | Critical | CRITICAL   | Use `.gitignore` on all `.env` files. Run `gitleaks` in CI (pre-commit hook). Rotate immediately if exposed. Use secrets manager in production. | Low           |
| T-013 | Spoofing               | Admin Account      | Admin account compromised via phishing, password reuse, or credential leak, giving attacker full system access | M          | Critical | CRITICAL   | Enforce MFA for all admin accounts. Enforce strong password policy (min 12 chars, complexity). Alert on admin login from new IP. Audit admin actions. | Medium        |
| T-014 | Spoofing               | Authentication     | Session fixation — attacker sets a known session token before login; if the server doesn't regenerate the token post-authentication, the attacker can hijack the session | L          | Medium   | LOW        | Always issue a fresh JWT upon successful login. Never accept a token pre-seeded by the client. Invalidate old tokens on re-login.  | Low           |
| T-015 | Elevation of Privilege | API — User Update  | Mass assignment vulnerability — attacker sends extra fields (e.g. `role: "ADMIN"`) in a request body that the server blindly passes to Prisma `update()`, escalating privileges | M          | Critical | CRITICAL   | Explicitly allowlist accepted fields in every Prisma `create`/`update` call. Use a DTO validation library (e.g. `zod`, `joi`) to strip unexpected fields before they reach the ORM. | Low           |

---

## Risk Matrix

```
                    IMPACT
                Low    Medium    High    Critical
              ┌──────┬─────────┬───────┬──────────┐
           H  │      │  T-006  │ T-004 │  T-003   │
LIKELIHOOD    │      │         │ T-009 │  T-008   │
           M  │      │  T-005  │ T-007 │  T-001   │  ← HIGH PRIORITY
              │      │  T-014  │ T-010 │  T-002   │
              │      │         │ T-011 │  T-012   │
              │      │         │       │  T-013   │
              │      │         │       │  T-015   │
           L  │      │         │ T-005 │          │
              └──────┴─────────┴───────┴──────────┘
```

**Risk Score Definitions:**

| Risk Score | Criteria                                         | Remediation Target     |
|------------|--------------------------------------------------|------------------------|
| CRITICAL   | High/Medium likelihood + Critical/High impact    | Fix before next release|
| HIGH       | Medium likelihood + High impact, or H + Medium   | Fix within sprint      |
| MEDIUM     | Low likelihood + High impact, or M + Medium      | Fix within quarter     |
| LOW        | Low likelihood + Low/Medium impact               | Accept or backlog      |

---

## Mitigation Status

| Threat ID | Status         | Owner              | Target Date  | Notes                                      |
|-----------|----------------|--------------------|--------------|--------------------------------------------|
| T-001     | Implemented    | Backend Team       | —            | Prisma ORM in use; semgrep rule added      |
| T-002     | In Progress    | Backend Team       | 2026-05-01   | Secret rotation procedure being drafted    |
| T-003     | In Progress    | Backend Team       | 2026-04-30   | Role middleware exists; audit in progress  |
| T-004     | Implemented    | Backend Team       | —            | express-rate-limit deployed                |
| T-005     | Planned        | DevOps             | 2026-06-01   | External log shipping not yet configured   |
| T-006     | Implemented    | Backend Team       | —            | Global error handler strips stack traces   |
| T-007     | Implemented    | Frontend/Backend   | —            | JWT in Authorization header; SameSite set  |
| T-008     | In Progress    | Backend Team       | 2026-05-15   | MIME validation partially implemented      |
| T-009     | Implemented    | Backend Team       | —            | Rate limiting on auth endpoints            |
| T-010     | In Progress    | Frontend Team      | 2026-05-01   | CSP headers being finalised                |
| T-011     | In Progress    | Backend Team       | 2026-04-30   | Ownership checks audit in progress         |
| T-012     | Implemented    | All / CI           | —            | gitleaks in pre-commit; .env in .gitignore |
| T-013     | Planned        | Product / DevOps   | 2026-07-01   | MFA feature on admin roadmap               |
| T-014     | Implemented    | Backend Team       | —            | Fresh JWT issued on every login            |
| T-015     | In Progress    | Backend Team       | 2026-05-01   | Zod schema validation being rolled out     |

---

## Assumptions and Limitations

1. This model assumes Nginx is deployed as a reverse proxy in production. Threats may be elevated if running Express directly on a public port.
2. SQLite is appropriate for the current scale. Migration to PostgreSQL is recommended above ~10 concurrent writers; the threat model should be re-evaluated at that point.
3. This model does not cover infrastructure-level threats (host OS vulnerabilities, cloud provider breaches, network interception below TLS).
4. Third-party npm dependencies are excluded from this model but should be tracked via `npm audit` and Dependabot.

---

## Review and Approval

| Role                  | Name          | Date       | Signature  |
|-----------------------|---------------|------------|------------|
| Security Lead         | *(pending)*   | —          | —          |
| Backend Engineering   | *(pending)*   | —          | —          |
| Product Owner         | *(pending)*   | —          | —          |

*Next scheduled review: 2026-07-06*
