# Security Runbook — Quantum Vorvex

**Document Version:** 1.0.0
**Last Updated:** 2026-04-06
**Classification:** INTERNAL — RESTRICTED
**Audience:** On-call engineers, security team, DevOps

> This runbook is a living document. Update it whenever procedures change. Keep it accessible to all on-call engineers.

---

## Table of Contents

1. [Responding to Alerts](#1-responding-to-alerts)
2. [Credential Rotation Procedures](#2-credential-rotation-procedures)
3. [Revoking a Compromised Token](#3-revoking-a-compromised-token)
4. [Incident Severity Classification](#4-incident-severity-classification)
5. [Escalation Matrix](#5-escalation-matrix)
6. [Post-Incident Review Template](#6-post-incident-review-template)
7. [Security Tools and Locations](#7-security-tools-and-locations)

---

## 1. Responding to Alerts

### 1.1 Authentication Failure Spike

**Trigger:** More than 20 failed login attempts from a single IP within 5 minutes, OR more than 100 failed login attempts across all IPs within 15 minutes.

**Indicators:**
- Log pattern: `[AUTH] Login failed` appearing at high frequency
- Rate limiter returning `429` to a concentration of IPs
- Monitoring alert: `auth_failures_per_minute > 20`

**Response Steps:**

1. **Confirm the alert.** Check the application logs:
   ```bash
   # If using file-based logs
   tail -f /var/log/quantum-vorvex/app.log | grep "Login failed"

   # If using Docker
   docker logs quantum-vorvex-server --since=15m | grep "Login failed"
   ```

2. **Identify the source IP(s):**
   ```bash
   grep "Login failed" /var/log/quantum-vorvex/app.log | awk '{print $NF}' | sort | uniq -c | sort -rn | head -20
   ```

3. **Check if the rate limiter is already blocking:**
   - If yes: monitor for escalation. Log the IP range for later review.
   - If no: the rate limiter may need tuning. Escalate to backend team.

4. **If a specific account is being targeted:**
   - Temporarily lock the account via the admin dashboard or directly in the DB:
     ```sql
     UPDATE users SET isLocked = 1 WHERE email = 'targeted@example.com';
     ```
   - Notify the account owner via their registered email.

5. **If the attack is broad-based credential stuffing:**
   - Consider a temporary block at the Nginx level for the attacking IP range.
   - Enable CAPTCHA if available on the login endpoint.
   - Escalate to P2 if the attack volume is affecting service availability.

6. **Document** the incident in the incident log with timestamp, source IPs, accounts targeted, and actions taken.

---

### 1.2 Rate Limit Spike

**Trigger:** Nginx or Express rate limiter returning `429` responses for more than 5% of total requests over a 5-minute window.

**Indicators:**
- Log pattern: `429 Too Many Requests` at elevated frequency
- Nginx access log showing repeated requests from single IP/subnet
- API response times increasing due to queue pressure

**Response Steps:**

1. **Check Nginx access logs for the spike source:**
   ```bash
   awk '{print $1}' /var/log/nginx/access.log | sort | uniq -c | sort -rn | head -20
   ```

2. **Determine if legitimate traffic or an attack:**
   - Review the User-Agent strings. Automated tools often reveal themselves.
   - Check if requests follow a human-like pattern or are machine-paced.

3. **If clearly malicious (bot/scraper/DoS attempt):**
   ```bash
   # Block the IP in Nginx (add to /etc/nginx/blocked_ips.conf)
   deny 203.0.113.0/24;
   nginx -s reload
   ```

4. **If legitimate traffic surge** (e.g. marketing event):
   - Temporarily increase rate limits in `server/src/middleware/rateLimiter.js`
   - Scale the server if horizontally scalable
   - Communicate expected load windows to the team in advance

5. **After stabilisation:**
   - Review rate limit thresholds — are they appropriate?
   - Add the attacking IP range to a long-term blocklist if attack was sustained.
   - File a post-incident note if P2 or above.

---

### 1.3 Unusual Admin Activity

**Trigger:** Admin actions performed at unusual hours, from a new IP, in rapid succession, or involving bulk data access/exports.

**Indicators:**
- Admin login from an IP not previously seen for that account
- Bulk `GET /api/v1/guests` calls from an admin account (potential data scraping)
- Admin account deleting multiple records in a short time window
- Admin password change not initiated by the account owner

**Response Steps:**

1. **Verify legitimacy with the account owner:**
   - Contact the admin via a trusted out-of-band channel (phone, Slack DM to known account).
   - Do NOT send verification emails to the potentially compromised email address.

2. **If the activity is unrecognised by the account owner:**
   - Immediately revoke the admin's JWT (see Section 3).
   - Force a password reset.
   - Review audit logs for the past 24 hours to determine what data was accessed.
   - Escalate to P1 if any guest PII was accessed or exported.

3. **Preserve forensic evidence:**
   ```bash
   # Export relevant logs before any rotation or restart
   cp /var/log/quantum-vorvex/app.log /tmp/incident-$(date +%Y%m%d-%H%M%S).log
   ```

4. **Review what actions were performed:**
   - Query the audit log table if instrumented.
   - Cross-reference with access logs to build a timeline.

5. **Escalate** according to Section 5 escalation matrix.

---

## 2. Credential Rotation Procedures

> All rotations must be coordinated to minimise downtime. Test in staging before applying to production.

### 2.1 JWT Secret Rotation

**When to rotate:**
- Scheduled quarterly rotation
- Suspected compromise (any time)
- After an engineer with access to the secret leaves the team

**Impact:** All currently active JWT tokens will be invalidated. All users will be logged out and must re-authenticate.

**Procedure:**

1. **Generate a new secret** (minimum 256-bit entropy):
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```

2. **Schedule the rotation** during a low-traffic window. Communicate to users if possible.

3. **Update the secret in the environment:**
   ```bash
   # On the production server, update the environment variable
   # Method depends on your deployment: .env file, secrets manager, or CI/CD secret store
   # Example for .env:
   JWT_SECRET=<new_secret_here>
   JWT_REFRESH_SECRET=<new_refresh_secret_here>
   ```

4. **Restart the application server:**
   ```bash
   pm2 restart quantum-vorvex-server
   # or
   docker-compose restart server
   ```

5. **Verify** the server started correctly and health check passes:
   ```bash
   curl -s http://localhost:5000/health
   ```

6. **Monitor** for elevated re-authentication traffic (expected) and any errors.

7. **Record** the rotation in the credentials log with date, reason, and engineer who performed it.

---

### 2.2 Database Password Rotation (Future — PostgreSQL migration)

*Currently not applicable as SQLite does not use a password. This section applies when/if the project migrates to a password-protected database.*

**Procedure (for future PostgreSQL setup):**

1. Generate a new strong password:
   ```bash
   openssl rand -base64 32
   ```

2. Update the password in PostgreSQL:
   ```sql
   ALTER USER quantumvorvex_app PASSWORD 'new_password_here';
   ```

3. Update `DATABASE_URL` in the environment configuration.

4. Restart the application server and verify DB connectivity.

5. Update any DB connection strings in CI/CD secrets stores.

---

### 2.3 API Key Rotation

Applies to any third-party service integrations (payment gateways, email providers, SMS providers, etc.).

**Procedure:**

1. **Identify all services** using the key to be rotated:
   ```bash
   grep -r "API_KEY\|SENDGRID\|STRIPE\|TWILIO" server/.env.example
   ```

2. **Generate a new key** in the service's dashboard.

3. **Update the key** in the environment variable store. Do not put the key in source code or commit it.

4. **Test** the integration in staging with the new key before applying to production.

5. **Apply** the new key to production and restart affected services.

6. **Revoke** the old key in the service dashboard only after confirming the new key works.

7. **Verify** no errors in the logs related to the rotated service.

---

## 3. Revoking a Compromised Token

Quantum Vorvex uses short-lived JWTs (access tokens). If a token is believed to be compromised, take the following steps.

### 3.1 Token Blacklist Approach

The application should maintain a token blacklist (a set of `jti` — JWT IDs) in fast storage (e.g. Redis or an in-memory store backed by the database).

**Steps to revoke a specific token:**

1. **Identify the `jti`** of the token to revoke. This is logged on login and stored in the JWT payload. Check application logs:
   ```bash
   grep "userId:<USER_ID>" /var/log/quantum-vorvex/app.log | grep "JWT issued"
   ```

2. **Add the `jti` to the blacklist.** If a blacklist table exists in the DB:
   ```sql
   INSERT INTO token_blacklist (jti, userId, revokedAt, expiresAt)
   VALUES ('<jti_value>', <user_id>, datetime('now'), '<token_expiry>');
   ```

3. **If the blacklist is Redis-backed:**
   ```bash
   redis-cli SET "blacklist:<jti>" "revoked" EX <seconds_until_token_expiry>
   ```

4. **Verify** the token is rejected by making a test request with it:
   ```bash
   curl -H "Authorization: Bearer <compromised_token>" http://localhost:5000/api/v1/rooms
   # Expected: 401 Unauthorized
   ```

### 3.2 Emergency: Revoke ALL Tokens

If you need to invalidate all tokens immediately (e.g. confirmed large-scale compromise):

1. **Rotate the JWT secret** (see Section 2.1). This immediately invalidates all tokens signed with the old secret.
2. All users will be required to re-authenticate.
3. Communicate this to users via email or status page.

### 3.3 Revoke All Tokens for a Specific User

1. Add all active `jti` values for the user to the blacklist, OR
2. Add a `tokensInvalidatedAt` timestamp to the user's DB record:
   ```sql
   UPDATE users SET tokensInvalidatedAt = datetime('now') WHERE id = <user_id>;
   ```
3. Update the JWT middleware to reject tokens issued before `tokensInvalidatedAt` for that user.

---

## 4. Incident Severity Classification

| Priority | Label     | Description                                                                                    | Examples                                                              |
|----------|-----------|------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------|
| P1       | Critical  | Active security breach, data exfiltration in progress, complete service outage                 | Admin account compromised, guest PII being exported, production DB deleted |
| P2       | High      | Significant security vulnerability confirmed, partial outage, high-impact bug in production    | JWT secret exposed in git, privilege escalation confirmed, service degraded >50% |
| P3       | Medium    | Security vulnerability identified but not actively exploited, non-critical feature broken      | XSS found in non-admin page, rate limiter misconfigured, slow API responses |
| P4       | Low       | Minor security finding, cosmetic issue, improvement opportunity                                | Missing security header, verbose error message in non-critical path, outdated dependency with no known exploit |

---

## 5. Escalation Matrix

| Severity | First Responder                  | Escalate To                             | Escalate Timeline  | Notification Channel       |
|----------|----------------------------------|-----------------------------------------|--------------------|----------------------------|
| P1       | On-call Engineer (immediate)     | Engineering Lead + CTO within 15 min   | Immediate          | Phone + Slack #incidents   |
| P2       | On-call Engineer                 | Engineering Lead within 1 hour         | < 1 hour           | Slack #incidents + email   |
| P3       | On-call Engineer                 | Team lead at next standup              | < 4 hours (working hours) | Slack #security-alerts |
| P4       | Any engineer                     | Backlog / next sprint planning         | Next sprint        | Jira ticket                |

**Contact Details (fill in before going live):**

| Role                     | Name           | Phone          | Email                          | Slack Handle    |
|--------------------------|----------------|----------------|--------------------------------|-----------------|
| On-call Engineer (1)     | *(fill in)*    | *(fill in)*    | *(fill in)*                    | *(fill in)*     |
| On-call Engineer (2)     | *(fill in)*    | *(fill in)*    | *(fill in)*                    | *(fill in)*     |
| Engineering Lead         | *(fill in)*    | *(fill in)*    | *(fill in)*                    | *(fill in)*     |
| CTO / Head of Product    | *(fill in)*    | *(fill in)*    | *(fill in)*                    | *(fill in)*     |
| Legal / Compliance       | *(fill in)*    | *(fill in)*    | legal@quantumvorvex.com        | *(fill in)*     |
| Customer Support Lead    | *(fill in)*    | *(fill in)*    | *(fill in)*                    | *(fill in)*     |

---

## 6. Post-Incident Review Template

A post-incident review (PIR) must be completed for all P1 and P2 incidents within 5 business days of resolution. P3 incidents should have a PIR within 2 weeks.

Use the full Post-Mortem template at `/docs/POST_MORTEM_TEMPLATE.md`.

**Minimum fields for a PIR entry in the incident log:**

```
Incident ID    : INC-YYYY-NNN
Date           : YYYY-MM-DD
Severity       : P1 / P2 / P3
Duration       : HH:MM
Summary        : One paragraph description of what happened and impact
Root Cause     : Single sentence
Action Items   : Comma-separated list of Jira ticket IDs
PIR Author     : Name
PIR Date       : YYYY-MM-DD
```

---

## 7. Security Tools and Locations

| Tool                  | Purpose                                         | Location / Command                                                     |
|-----------------------|-------------------------------------------------|------------------------------------------------------------------------|
| gitleaks              | Detect secrets committed to Git                 | `gitleaks detect --source .` (install: `brew install gitleaks`)        |
| semgrep               | Static analysis for security patterns           | `semgrep --config .semgrep.yml .` (install: `pip install semgrep`)     |
| npm audit             | Check for known vulnerabilities in dependencies | `cd server && npm audit` / `cd client && npm audit`                    |
| ESLint security plugin| Lint for insecure code patterns                 | `cd server && npx eslint . --plugin security`                          |
| security-audit.sh     | All-in-one local security scan                  | `bash scripts/security-audit.sh`                                       |
| smoke-test.sh         | Basic API health and auth checks                | `bash scripts/smoke-test.sh`                                           |
| k6 load tests         | Performance and stress testing                  | `k6 run k6/load-test.js --scenario smoke`                              |
| Pre-commit hooks      | Automated checks before every git commit        | `pre-commit install` (config: `.pre-commit-config.yaml`)               |
| .env file             | Environment variables (never commit)            | `server/.env` (copy from `server/.env.example`)                        |
| Application logs      | Runtime logs                                    | `server/logs/` or `docker logs quantum-vorvex-server`                  |

---

*This runbook is maintained by the Quantum Vorvex engineering team. For changes, open a PR targeting the `main` branch and request review from the security lead.*
