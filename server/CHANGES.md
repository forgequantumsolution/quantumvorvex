# Server Changelog

Backend changes. Frontend changes are logged in [../client/CHANGES.md](../client/CHANGES.md).
Paths below are relative to `server/`.

---

# Session — 2026-06-10 · Single active session per user (new-login-wins)

## Summary
Enforce **one active session per user** across all roles (owner/manager/staff). Logging in on a
new device invalidates the session on any previous device — the old device is bounced to login on
its next request. Implemented with a `sessionVersion` counter embedded in the JWT and validated
server-side on every authenticated request (the previously stateless JWT could not be revoked).
Frontend handling of the resulting 401 is logged in [../client/CHANGES.md](../client/CHANGES.md).

## File changes

### `prisma/schema.prisma`
- `User` — added `sessionVersion Int @default(0)`. Migration: `20260610091925_add_session_version`
  (additive, `@default(0)` backfills existing rows — no data loss).

### `src/controllers/authController.js`
- `issueAuthToken` — added `sessionVersion` to the JWT payload.
- `login` and `verifyOtp` — after successful auth, atomically `increment` the user's
  `sessionVersion` and sign the token with the new value. The increment is what makes any token
  held by a previously logged-in device stale.

### `src/middleware/auth.js`
- `verifyToken` is now `async`. After `jwt.verify`, it looks up the user and:
  - rejects if the user is missing/`inactive` → `401 ERR_SESSION_INVALID`;
  - rejects if `user.sessionVersion !== decoded.sessionVersion` →
    `401 ERR_SESSION_SUPERSEDED` ("logged in on another device").
- Cost: one indexed PK lookup per authenticated request (negligible at this scale).

## Notes
- On first deploy, all pre-existing tokens lack a matching `sessionVersion` → every user is logged
  out once and must sign in again. Expected.
- The separate `Staff`/`StaffSession` auth system is unaffected — this covers the `User`/JWT flow only.

---

# Session — 2026-06-04 · Bug fixes surfaced during frontend integration

While wiring the frontend modules to the real backend, the following backend issues were
found and fixed. These were genuine bugs (most code paths had never been exercised by the
previously mock-only client).

## 1. Route ordering — `src/routes/staff.js`
`PUT /:id` was registered **before** `PUT /permissions`, so `PUT /staff/permissions` matched
the parameterized route (`id = "permissions"`) and called `updateStaff` → Prisma error / 500.

**Fix:** moved the static `/activity` and `/permissions` routes above `/:id`.

```diff
  router.get('/', verifyToken, getStaff)
  router.post('/', verifyToken, createStaff)
- router.put('/:id', verifyToken, updateStaff)
- router.get('/activity', verifyToken, getActivity)
- router.get('/permissions', verifyToken, getPermissions)
- router.put('/permissions', verifyToken, updatePermissions)
+ router.get('/activity', verifyToken, getActivity)
+ router.get('/permissions', verifyToken, getPermissions)
+ router.put('/permissions', verifyToken, updatePermissions)
+ router.put('/:id', verifyToken, updateStaff)
```

## 2. JSON-string columns — `src/controllers/guestsController.js`
`tags`, `amenities`, and `facilities` are `String @default("[]")` columns (JSON strings), but
`createGuest`/`updateGuest` passed JavaScript **arrays** → Prisma 500 on `POST /guests`.

**Fix:**
- `createGuest` — wrap with `JSON.stringify(... || [])` for `tags`, `amenities`, `facilities`.
- `updateGuest` — `if (Array.isArray(data.<field>)) data.<field> = JSON.stringify(data.<field>)`
  for the same three fields.

## 3. KYC list fields — `src/controllers/documentsController.js`
`getDocuments` did not return the guest ID-type/number or room, which the Documents (KYC)
table displays.

**Fix:** added `idType`, `idNumber`, and `room: { select: { number: true } }` to the
`prisma.guest.findMany` select.

## 4. Auth rate limiter (dev) — `src/app.js`
`authLimiter` allowed only **10 auth requests / 15 min per IP**, which locked out local
end-to-end test runs (every UI login is a `POST /auth/login`).

**Fix:** generous in non-production, **unchanged in production**:

```diff
- windowMs: 15 * 60 * 1000, max: 10,
+ windowMs: 15 * 60 * 1000, max: process.env.NODE_ENV === 'production' ? 10 : 1000,
```

---

## Notes / unchanged
- No schema migrations were added; all fixes are controller/route/middleware level.
- Endpoints with no backend support that the frontend references (left as gaps, not added):
  Billing ledger & cash register, message-template creation, pricing competitor benchmarking,
  staff session/force-logout, maintenance preventive-schedule UI.
