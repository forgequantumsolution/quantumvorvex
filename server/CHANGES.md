# Server Changelog

Backend changes. Frontend changes are logged in [../client/CHANGES.md](../client/CHANGES.md).
Paths below are relative to `server/`.

---

# Session — 2026-06-10 · Invoice PDF rendering (Puppeteer)

## Summary
The invoice endpoint only emitted HTML, so the client's "download" saved a `.html` file. Added a
`format=pdf` mode that renders the existing invoice template to a real PDF via Puppeteer, returning
`application/pdf`. Same template → the PDF is identical to the HTML preview.

## File changes

### `src/utils/pdf.js` (new)
- `htmlToPdf(html, { baseUrl })` — launches/reuses a headless Chrome (relaunch on disconnect), injects a
  `<base href="${baseUrl}/">` so the template's relative `/uploads/logo.png` resolves against the running
  server, then `page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true })`.
- Chrome executable resolved from `PUPPETEER_EXECUTABLE_PATH` / `CHROME_PATH`, then common Win/Linux/macOS
  paths (falls back to Puppeteer's own resolution).
- `closePdfBrowser()` for best-effort shutdown.

### `src/controllers/bookingsController.js`
- `getBookingInvoice` — new `format=pdf` branch: renders the template HTML, converts via `htmlToPdf`
  (passing `${req.protocol}://${req.get('host')}` as `baseUrl`), responds `application/pdf` inline. On
  failure returns `500 { code: 'ERR_PDF_RENDER' }` with a "Chrome must be installed" hint.

### `.npmrc` (new)
- `puppeteer_skip_download=true` — we drive an installed Chrome rather than Puppeteer's bundled Chromium
  (the bundled download was failing locally). Documents the env overrides + the "remove this for envs
  without Chrome" escape hatch.

### `package.json`
- Added dependency **`puppeteer` ^25.1.0**.

## Notes
- **Deploy requirement:** with the skip-download flag, the server needs a Chrome/Chromium binary present
  at runtime (set `PUPPETEER_EXECUTABLE_PATH` if non-standard), or remove the `.npmrc` line to let
  Puppeteer bundle its own.
- Verified locally: renders a valid PDF (`%PDF-` header) using the detected system Chrome.
- HTML (`format=html`) and JSON (`format=json`) responses are unchanged.

---

# Session — 2026-06-10 · Log payment method at check-out + show it on the invoice

## Summary
Check-out accepted only `extraCharges` / `finalPayment` and never recorded **how** the guest paid.
The collection now logs a `Payment` row (method + reference) against the guest, and the generated tax
invoice lists those collections in a new Payment Details block.

## File changes

### `src/middleware/validate.js`
- `checkOutBooking` schema now accepts `paymentMethod` (enum: cash / card / upi / bank_transfer /
  cheque / other) and `paymentReference` (string, max 120) — both optional.

### `src/controllers/bookingsController.js`
- `checkOutBooking` — when `finalPayment > 0` and the booking has a `guestId`, creates a `Payment`
  inside the existing transaction (`amount`, `method`, `reference`, `type: 'collection'`). Method
  defaults to `cash`.
- `getBookingInvoice` — the invoice query now includes `guest.payments` (oldest-first) so collections
  can be rendered.

### `src/utils/invoiceTemplate.js`
- Added a `PAYMENT_METHOD_LABELS` map + `paymentMethodLabel()` helper.
- `buildInvoiceData` derives a `payments` array (collection-type only: date, method, reference, amount),
  also exposed in the `format=json` payload.
- Template renders a **Payment Details** table in the lower-left (beside Bank Details), only when
  payments exist; added matching CSS.

## Notes
- A guest is created per booking at check-in, so collections map cleanly to that stay's invoice.
- Advances taken at booking/check-in are still only the booking's `advance` field (shown as "Received
  Amount"); they are not logged as `Payment` rows, so they don't appear in the Payment Details list.
- No schema/migration change — reuses the existing `Payment` model.

---

# Session — 2026-06-10 · Settings update: delete rows absent from the payload

## Summary
Wiring the Settings tabs to `PUT /settings` (frontend change, see `../client/changes.md`) exposed a
gap: `updateSettings` upserted the submitted room types / food plans / amenities but never deleted
ones the user had removed in the UI — so deletions reappeared on reload. Each submitted collection is
now treated as the full desired set.

## File changes

### `src/controllers/settingsController.js`
- `updateSettings` — after upserting each collection, deletes the rows whose `name` is not in the
  submitted array:
  - `roomType.deleteMany({ name: { notIn }, rooms: { none: {} } })` — guarded by `rooms: none` so a
    type still referenced by a `Room` is kept (avoids an FK violation) rather than erroring.
  - `foodPlan.deleteMany` / `amenity.deleteMany` by `name notIn` — no FK relations, safe to remove.

## Notes
- `name` is the stable key here (it's `@unique` on all three models and matches the upsert-by-name path).
- A room type in use is silently retained on save; surfacing a "can't delete — rooms assigned" message
  would need richer per-row feedback (not done).
- No schema/migration change.

---

# Session — 2026-06-10 · Document viewing + verification fixes (booking docs + static serving)

## Summary
Documents uploaded during booking showed as "uploaded" but never appeared in the Documents panel,
guest-uploaded docs couldn't be opened, and verifying a booking doc 500'd. Causes: (1) `GET /documents`
only read the `Document` table, but booking ID uploads land in the separate `BookingDocument` table;
(2) the `/uploads` static handler pointed one directory above where files are actually written;
(3) `PUT /documents/:id/verify` only updated `Document`, and `BookingDocument` had no `verified` column.

## File changes

### `prisma/schema.prisma`
- `BookingDocument` — added `verified Boolean @default(false)`. Migration:
  `20260610143126_add_bookingdocument_verified` (additive, backfills existing rows — no data loss).

### `src/controllers/documentsController.js`
- `getDocuments` — now also pulls each guest's bookings' `BookingDocument` rows (via
  `Booking.guestId → Guest`) and merges them into the per-guest `documents` array, normalized to the
  same shape the client renders (`id`, `docType`, `url`, `verified`, `uploadedAt`), each tagged
  `source: 'booking'`. `verified` reflects the real column value. `_count.documents` is the combined total.
- `verifyDocument` — two fixes:
  - **Root cause of the 500:** the endpoint is called with no request body, and under Express 5
    `req.body` is `undefined` for a bodyless request, so `const { verified } = req.body` threw before
    any DB call. Now `req.body || {}`.
  - The id may belong to either table. Now uses `updateMany` against `Document` first, then falls back
    to `BookingDocument`; returns 404 only if neither matches. (`updateMany` returns a count instead of
    throwing on no-match, replacing the prior throw-based P2025 handling.)

### `src/app.js`
- `/uploads` static handler — files are written to `<server>/uploads` (multer's `path.resolve` is
  cwd-relative), but the handler served from the project root (`'..', '..'`). Dropped one `'..'` so it
  serves `<server>/uploads`. This had caused `ERR_NOT_FOUND` on every document/logo link.

## Notes
- Requires `prisma generate` + a backend restart to pick up the regenerated client and new column.
- Booking docs and guest KYC docs are now both viewable and verifiable through the same panel.
- Uploaded files still live on server local disk (not the DB) — see the object-storage migration follow-up.

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

### `.env` / `.env.example`
- Added `ENFORCE_SINGLE_SESSION` flag (default `false`) to both files. **Off in local dev** so
  E2E/demo logins don't evict each other; set `true` in production. Gates both the version bump and
  the middleware check — when off, auth is fully stateless (original behaviour, no per-request DB hit).

### `src/controllers/authController.js`
- `issueAuthToken` — added `sessionVersion` to the JWT payload.
- `login` and `verifyOtp` — when `ENFORCE_SINGLE_SESSION` is on, atomically `increment` the user's
  `sessionVersion` and sign the token with the new value. The increment is what makes any token
  held by a previously logged-in device stale. When off, no bump (token carries no version).

### `src/middleware/auth.js`
- `verifyToken` is now `async`. When `ENFORCE_SINGLE_SESSION` is on, after `jwt.verify` it looks up
  the user and:
  - rejects if the user is missing/`inactive` → `401 ERR_SESSION_INVALID`;
  - rejects a token with **no** `sessionVersion` claim (issued before this feature, or after a
    DB reset/reseed) → `401 ERR_SESSION_EXPIRED` ("session expired, please sign in again") —
    distinct copy so the migration logout isn't mislabelled as a takeover;
  - rejects if `user.sessionVersion !== decoded.sessionVersion` →
    `401 ERR_SESSION_SUPERSEDED` ("logged in on another device").
  - Cost: one indexed PK lookup per authenticated request (negligible at this scale).
- When the flag is off, the whole block is skipped — no DB hit, no eviction.

## Notes
- **Why gated:** during development the owner account hit `sessionVersion = 51` because E2E/demo
  logins each bumped it, evicting the real browser session "after a while." The flag keeps strict
  single-session for production while letting dev/test logins coexist.
- When first enabled in production, all pre-existing tokens lack a matching `sessionVersion` →
  every user is logged out once and must sign in again. Expected.
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
