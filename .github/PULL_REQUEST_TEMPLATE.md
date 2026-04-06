## Description

<!-- Provide a clear and concise summary of the changes in this pull request.
     Include the motivation / context: what problem does this solve?
     If this closes a GitHub issue, link it here: "Closes #<issue-number>" -->

**What changed and why:**

**Related issues / tickets:**

---

## Type of Change

<!-- Check all that apply by replacing [ ] with [x] -->

- [ ] Bug fix — non-breaking change that resolves an issue
- [ ] New feature — non-breaking change that adds functionality
- [ ] Security fix — patch for a vulnerability or security weakness
- [ ] Breaking change — fix or feature that causes existing functionality to behave differently
- [ ] Refactor — code change that neither fixes a bug nor adds a feature
- [ ] Performance improvement — change that improves speed or resource usage
- [ ] Documentation update — changes to docs, comments, or README only
- [ ] CI/CD / DevOps — changes to pipeline, Docker, nginx, or tooling configuration
- [ ] Dependency update — package version bump (explain why in Description above)

---

## Security Checklist

<!-- Every PR that modifies server-side code MUST have this section reviewed.
     Check each item that applies, or mark N/A with a brief note if it truly
     does not apply to this change. Unchecked items will block merge. -->

- [ ] **No hardcoded secrets** — No API keys, passwords, tokens, or credentials are committed. All secrets are read from environment variables or a secrets manager.
- [ ] **All user inputs validated** — Every controller that accepts request body, query, or path parameters uses an input validation library (e.g., Zod, Joi, express-validator) with an explicit schema. No unvalidated data flows downstream.
- [ ] **Auth middleware applied** — All new or modified routes that access protected resources have the `authenticate` (and where appropriate `authorize`) middleware applied. No endpoint accidentally left public.
- [ ] **No raw SQL** — Database access goes through the Prisma ORM. There are no `$queryRaw` or `$executeRaw` calls with unsanitized user input.
- [ ] **No eval with user input** — `eval()`, `new Function()`, `setTimeout(string)`, `setInterval(string)`, and similar dynamic code execution patterns are not used with data that originates from user input.
- [ ] **Error messages do not expose internals** — Error responses returned to the client do not include stack traces, file paths, database error messages, or other implementation details. A generic message is sent; full details go to the server log only.
- [ ] **New dependencies are pinned** — Any newly added npm package uses an exact version pin (e.g., `"1.2.3"` not `"^1.2.3"`) or the PR explains why a range is acceptable. The package has been audited with `npm audit`.
- [ ] **Sensitive data is not logged** — Passwords, tokens, PII (guest names, ID numbers, payment info), and session identifiers are not written to application logs at any level.
- [ ] **File uploads are validated** — If this PR touches file upload functionality, the MIME type, file extension, and file size are all validated server-side. Files are stored outside the web root, and filenames are sanitized or replaced with a UUID.
- [ ] **Tests written for the change** — New logic, edge cases, and failure paths introduced by this PR have corresponding unit or integration tests. Test coverage has not decreased.
- [ ] **CORS configuration is correct** — No wildcard (`*`) origins have been added to CORS config for credentialed requests. Any new allowed origins are intentional and documented.
- [ ] **Rate limiting considered** — Endpoints that perform expensive operations, send emails, or are authentication-related are protected by appropriate rate limiting middleware.
- [ ] **HTTP security headers unchanged or improved** — Existing security headers (CSP, HSTS, X-Frame-Options, etc.) are not weakened by this change.
- [ ] **Dependency integrity** — If `package-lock.json` changed, the diff has been reviewed to confirm no unexpected transitive dependency was added or updated.
- [ ] **OWASP Top 10 self-review** — The author has considered the OWASP Top 10 (https://owasp.org/www-project-top-ten/) and determined that none of the top 10 categories are introduced or worsened by this change.

---

## Testing Checklist

<!-- Describe how this PR was tested and what test environments were used. -->

- [ ] Unit tests pass locally (`npm test` in server/)
- [ ] Client builds without errors (`npm run build` in client/)
- [ ] Manual testing performed in local development environment
- [ ] New tests added for new functionality (if applicable)
- [ ] Existing tests were not broken by this change
- [ ] Edge cases and error paths have been tested
- [ ] API endpoints tested with a tool such as Postman, Insomnia, or curl
- [ ] UI changes verified in at least one modern browser

**Test environment details:**
- Node.js version:
- OS:
- Browser(s) tested (if UI change):

---

## Screenshots

<!-- If this PR includes UI changes, add before/after screenshots or a short
     screen recording. Delete this section if the PR is backend-only. -->

**Before:**

**After:**

---

## Additional Notes

<!-- Any follow-up tasks, known limitations, deployment steps, environment
     variable changes, or migration steps the reviewer should be aware of. -->
