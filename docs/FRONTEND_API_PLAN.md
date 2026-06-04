# Frontend API Integration Plan

> **STATUS (updated 2026-06-04): Implemented.** All orphaned modules below are now wired to
> the real backend, mounted in the sidebar with role-gating, and covered by Playwright tests
> running against the live stack (frontend :5173 + backend :5000 + Postgres). 27 E2E tests pass.
> See "Implementation log" at the bottom.



> Generated 2026-06-04. Scope: every backend API in `server/src/routes/` cross-referenced
> against the client's API layer (`client/src/api/client.js`), panel registry
> (`client/src/App.jsx`), and navigation (`client/src/components/layout/Sidebar.jsx`).
> Goal: list every API that still needs UI + wiring, and a phased plan to deliver it.

---

## 1. What we just pulled

The last `git pull origin shriyansh/frontend` fast-forwarded 2 commits (`92457f5`, `13c1f84`)
focused on **Maintenance**:

- **Schema** (`schema.prisma` → `MaintenanceRequest`): added `ticketNo` (unique), `category`
  (Plumbing/Electrical/HVAC/Furniture/Housekeeping/Other), `title`, `updatedAt`; made
  `description`/`reportedBy` optional; `issueType` is now a legacy alias; priority enum now
  `Low | Medium | High | Urgent` (was `Critical`).
- **Validation** (`validate.js`): new `createMaintenanceRequest`, `updateMaintenanceRequest`,
  `addMaintenanceNote` schemas; `validate()` now tolerates an empty body.
- **Routes** (`maintenance.js`): added `DELETE /:id` (manager+), validation on create/update/notes.
- **Client**: `Maintenance.jsx`, `NewTicketModal.jsx`, `TicketCard.jsx` updated to the new
  ticket shape (ticketNo/category/title). **Already wired** to `maintenanceApi`.

**Residual frontend work from this pull** (see §4-A) — the new `DELETE /:id` and the
preventive-maintenance `schedule` endpoints are **not** surfaced in the UI yet.

---

## 2. How the connection layer works (for reference)

A new panel becomes "live" only when all four are in place:

1. **API helper** — exported object in [client/src/api/client.js](../client/src/api/client.js)
   (e.g. `roomsApi`, `bookingsApi`). All requests go through the shared `axios` instance,
   which attaches the `qv_token` bearer and, when `VITE_MOCK=true`, short-circuits to
   `mockData.js` instead of hitting the server.
2. **Module component** — under `client/src/components/modules/<name>/`.
3. **Panel registration** — entry in `PANEL_MAP` in [client/src/App.jsx](../client/src/App.jsx#L77).
4. **Navigation + access** — entry in `NAV_SECTIONS` in
   [Sidebar.jsx](../client/src/components/layout/Sidebar.jsx#L5) **and** in
   `ROLE_PANELS` in [permissions.js](../client/src/utils/permissions.js#L29).

> ⚠️ The client is currently **deliberately scoped to 5 front-desk panels**
> (`bookings, checkin, checkout, cancellations, maintenance` — see the
> "Focus client on 5 front-desk features" commit). `ROLE_PANELS` and `NAV_SECTIONS`
> only list those five. Every other module `.jsx` file already exists but is
> **orphaned**: not in `PANEL_MAP`, not in the nav, and using local `useState`/mock
> data instead of an API. So most "frontend work" below is **wiring + API connection**,
> not building UI from scratch.

---

## 3. Status matrix — backend API vs. frontend

| Backend route group | API helper in `client.js`? | UI module exists? | Wired in nav/PANEL_MAP? | Work needed |
|---|---|---|---|---|
| `auth` | ✅ `authApi` | ✅ Login/Reset | ✅ (auth flow) | Done |
| `bookings` | ✅ `bookingsApi` | ✅ Bookings | ✅ | **Done** |
| `maintenance` | ⚠️ partial | ✅ Maintenance | ✅ | §4-A (delete + schedule) |
| `guests` | ✅ `guestsApi` | ✅ Guests.jsx (mock) | ❌ | §4-C |
| `rooms` | ✅ `roomsApi` | ✅ Rooms.jsx (mock) | ❌ | §4-C |
| `billing` | ✅ `billingApi` | ✅ Billing.jsx (mock) | ❌ | §4-C |
| `documents` | ✅ `documentsApi` | ✅ Documents.jsx (mock) | ❌ | §4-C |
| `foodPlans` | ⚠️ partial `foodApi` | ✅ Food.jsx (mock) | ❌ | §4-C |
| `reports` | ✅ `reportsApi` | ✅ Reports + Dashboard (mock) | ❌ | §4-C |
| `settings` | ✅ `settingsApi` | ✅ Settings.jsx | ❌ | §4-C |
| `notifications` | ✅ `notificationsApi` | partial (Topbar) | ❌ | §4-C |
| `housekeeping` | ❌ **none** | ✅ Housekeeping.jsx (mock) | ❌ | §4-B |
| `staff` | ❌ **none** | ✅ Staff.jsx (mock) | ❌ | §4-B |
| `pricing` | ❌ **none** | ❌ (lives in Settings tab) | ❌ | §4-B |
| `reminders` | ❌ **none** | ❌ | ❌ | §4-B |
| `users` | ❌ **none** | ❌ (Settings "users" tab) | ❌ | §4-B |

Legend: ✅ done · ⚠️ partial · ❌ missing · "(mock)" = component renders from local/mock data, not the API.

---

## 4. Detailed work items

### 4-A. Maintenance — finish the pulled feature

`maintenanceApi` already has `getAll, create, update, addNote, remove, schedules`. Gaps:

1. **Delete ticket** — backend `DELETE /maintenance/:id` (manager+) exists and
   `maintenanceApi.remove(id)` exists, but **no UI control** calls it.
   - Add a delete action on `TicketCard.jsx` / ticket detail, role-gated to manager/owner
     (`isOwnerOrManager(role)`), with a confirm modal. On success refetch + toast.
2. **Preventive-maintenance schedule** — backend `GET /maintenance/schedule` &
   `POST /maintenance/schedule` exist; `maintenanceApi.schedules()` (GET) exists but
   **`createSchedule` is missing** from the helper, and there's **no schedule UI**.
   - Add `createSchedule: (data) => api.post('/maintenance/schedule', data)` to `maintenanceApi`.
   - Add a "Schedules" tab to `Maintenance.jsx` listing schedules + a create form.
3. **Field audit** — confirm `NewTicketModal.jsx` priority dropdown uses
   `Low/Medium/High/Urgent` (not the old `Critical`) and `category` matches the enum.

---

### 4-B. APIs with NO client helper (build helper + UI + wire)

These have **zero** frontend connection. Each needs: (a) a new helper in `client.js`,
(b) the existing/new module switched from mock to that helper, (c) nav + `PANEL_MAP` +
`ROLE_PANELS` entries (or Settings-tab wiring where noted), (d) mock entries in `mockData.js`.

#### Housekeeping — `/api/v1/housekeeping`
Module `Housekeeping.jsx` exists (board/daily/linen/inspection tabs) on mock data.
```js
export const housekeepingApi = {
  getBoard:       ()              => api.get('/housekeeping/board'),
  updateStatus:   (roomId, data)  => api.put(`/housekeeping/${roomId}/status`, data), // {status, assignedTo, startedAt, completedAt}
  getDaily:       ()              => api.get('/housekeeping/daily'),
  getLinen:       ()              => api.get('/housekeeping/linen'),
  markLinen:      (roomId, data)  => api.put(`/housekeeping/linen/${roomId}`, data),   // {changedBy, frequency}
  submitInspection:(data)         => api.post('/housekeeping/inspection', data),        // {roomId, staffId, checklist}
}
```
UI: replace local board state with `getBoard`/`getDaily`; wire status changes, linen
"mark changed", and the inspection checklist submit.

#### Staff — `/api/v1/staff`
Module `Staff.jsx` exists (list / activity / permissions tabs) on mock data.
```js
export const staffApi = {
  getAll:           ()         => api.get('/staff'),
  create:           (data)     => api.post('/staff', data),          // {name, phone, email, role, password}
  update:           (id, data) => api.put(`/staff/${id}`, data),
  getActivity:      (params)   => api.get('/staff/activity', { params }), // {staffId, module, from, to}
  getPermissions:   ()         => api.get('/staff/permissions'),
  updatePermissions:(data)     => api.put('/staff/permissions', data), // {permissions:[{role,module,level}]}
}
```
UI: wire the three tabs; the permissions matrix maps to the `[{role,module,level}]` shape.

#### Pricing — `/api/v1/pricing`
No standalone module; pricing is an owner Settings tab (`ROLE_SETTINGS_TABS.owner` includes `pricing`).
```js
export const pricingApi = {
  getRules: ()      => api.get('/pricing/rules'),
  saveRules:(rules) => api.put('/pricing/rules', { rules }),
  compute:  (data)  => api.post('/pricing/compute', data), // {roomId, stayType, months, checkIn, checkOut}
}
```
UI: build the Pricing rules editor inside Settings; optionally surface `compute` in the
booking flow as a live rate preview (`NewBookingModal.jsx`).

#### Reminders — `/api/v1/reminders`
No UI yet.
```js
export const remindersApi = {
  send:           (data)     => api.post('/reminders/send', data),       // {guestId, channel, message} → {reminder, fallbackUrl}
  getTemplates:   ()         => api.get('/reminders/templates'),
  updateTemplate: (id, data) => api.put(`/reminders/templates/${id}`, data),
}
```
UI: a "Send reminder" action on guest/booking rows (WhatsApp/SMS/email channel picker;
`fallbackUrl` opens the channel deep-link) + a template editor (likely a Settings tab).

#### Users — `/api/v1/users` (owner-only)
Surfaced via Settings "users" tab (owner/admin only).
```js
export const usersApi = {
  getAll: ()        => api.get('/users'),
  create: (data)    => api.post('/users', data),       // {name, email, password, role, phone}
  update: (id, data)=> api.put(`/users/${id}`, data),  // {name,email,phone,role,status,password}
  delete: (id)      => api.delete(`/users/${id}`),
}
```
UI: user-management table in Settings — create/edit/delete, role assignment
(only owner may assign `owner`; cannot delete self or last owner — surface these 400/403 errors).

---

### 4-C. APIs with a helper but orphaned/mock UI (connect + wire)

Helper already exists in `client.js`; the module renders from mock/local data and isn't in
the nav. Work = swap mock → helper, add nav/PANEL_MAP/ROLE_PANELS (or Settings-tab) entries.

| Module | Helper | Gaps to close |
|---|---|---|
| **Guests** | `guestsApi` | Wire `Guests.jsx` list/create/edit/checkout to `getAll/create/update/checkout`; add nav + panel. |
| **Rooms** | `roomsApi` | Wire `Rooms.jsx` CRUD; currently only used read-only inside booking/ticket modals. Add as Settings "rooms" tab or panel. |
| **Billing** | `billingApi` | Wire `Billing.jsx` to `getAll/generate/collect/getPdf`; PDF via blob download. Add nav + panel. |
| **Documents** | `documentsApi` | Wire `Documents.jsx` upload (multipart)/verify; tie into guest check-in (ID upload). |
| **Food** | `foodApi` (partial) | `foodApi` only has `getPlans/getOrders`. **Add `createPlan/updatePlan/deletePlan`** (`POST/PUT/DELETE /food-plans/:id`). Wire `Food.jsx`. |
| **Reports/Dashboard** | `reportsApi` | Wire `Dashboard.jsx` + `Reports.jsx` to `getDashboard/getRevenue/getGst/exportCsv` (blob). |
| **Settings** | `settingsApi` | `Settings.jsx` imports the helper; verify all tabs persist (`get/update/uploadLogo`) and host the pricing/users/reminders sub-features above. |
| **Notifications** | `notificationsApi` | Wire the Topbar bell to `getAll/dismiss/clearAll` (poll or on-open). |

Add to `foodApi`:
```js
createPlan: (data)     => api.post('/food-plans', data),
updatePlan: (id, data) => api.put(`/food-plans/${id}`, data),
deletePlan: (id)       => api.delete(`/food-plans/${id}`),
```

---

## 5. Cross-cutting tasks (do once, affects all of §4-B/C)

1. **Un-scope the nav** — extend `NAV_SECTIONS` in `Sidebar.jsx` with sections beyond
   "Front Desk" (e.g. Operations: housekeeping, rooms; Finance: billing, reports;
   Admin: staff, users, settings) as each module goes live.
2. **Permissions** — extend `ROLE_PANELS` in `permissions.js` per role for every new panel
   (currently all roles see only the 5 front-desk panels). Keep owner-only panels
   (users, pricing) gated.
3. **PANEL_MAP** — register each newly-wired module in `App.jsx` (lazy-import to keep bundle small).
4. **Mock data** — add matching entries in `client/src/api/mockData.js` so `VITE_MOCK=true`
   demo mode keeps working for every new endpoint (the mock adapter routes by method+url).
5. **Validation schemas** — backend now enforces Zod schemas (maintenance, auth, bookings,
   users). Mirror client-side validation in `client/src/validation/` for new forms
   (staff, pricing, reminders, users) to match server contracts and avoid round-trip 400s.
6. **Error surfacing** — backend returns `{ error }` (and `{ errors:[{field,message}] }` from
   `validate`). Ensure forms map field errors to inputs and toast the top-level message.

---

## 6. Suggested phasing

**Phase 0 — finish the pull (small).** §4-A: maintenance delete UI + `createSchedule` helper
+ schedule tab + priority/category audit.

**Phase 1 — connect existing helpers (medium).** §4-C the modules that already have helpers
and just need mock→API + nav: Guests, Rooms, Billing, Reports/Dashboard, Notifications,
Food (after adding the 3 plan helpers), Documents. Plus the cross-cutting nav/permissions/
PANEL_MAP/mock wiring (§5.1-5.4).

**Phase 2 — build missing helpers + UI (larger).** §4-B: Housekeeping and Staff (UI exists,
build helpers + wire), then Pricing, Users, Reminders (Settings tabs / cross-module actions).

**Phase 3 — polish.** Client-side validation parity (§5.5), error mapping (§5.6),
loading/empty states, role-gating review, and removing mock fallbacks where real APIs are stable.

---

## 7. Quick reference — missing API helpers to add to `client.js`

- [ ] `housekeepingApi` (6 methods)
- [ ] `staffApi` (6 methods)
- [ ] `pricingApi` (3 methods)
- [ ] `remindersApi` (3 methods)
- [ ] `usersApi` (4 methods)
- [ ] `maintenanceApi.createSchedule` (1 method)
- [ ] `foodApi.createPlan / updatePlan / deletePlan` (3 methods)

---

## Implementation log (2026-06-04)

### Modules wired to the real backend + mounted in nav (with Playwright tests)

| Module | Nav section | Roles | Real API wiring | Tests |
|---|---|---|---|---|
| Housekeeping | Operations | all | board read, status PUT, linen, inspection | ✅ |
| Guests | Operations | all | list, profile detail, edit, checkout | ✅ |
| Rooms | Operations | all | list, create, status PUT | ✅ |
| Documents | Operations | owner/manager | list, multipart upload, verify | ✅ |
| Food | Operations | owner/manager | plans CRUD, orders read | ✅ |
| Billing | Finance | owner/manager | invoices, generate, collect, remind | ✅ |
| Reports | Finance | owner/manager | dashboard, revenue, GST, CSV export, occupancy from rooms | ✅ |
| Staff | Administration | owner | list, create, update, activity, permissions | ✅ |
| Settings | Administration | owner/manager | hotel settings load, **Users** CRUD, **Pricing rules** load/save | ✅ |

Wiring lives in `client/src/api/client.js` (new helpers: `housekeepingApi`, `staffApi`,
`usersApi`, `pricingApi`, `remindersApi`, plus `foodApi.createPlan/updatePlan/deletePlan`
and `maintenanceApi.createSchedule`). Nav: `Sidebar.jsx` (Operations / Finance / Administration
sections). Access: `permissions.js` `ROLE_PANELS`. Panels: `App.jsx` `PANEL_MAP`.

### Backend bugs fixed along the way
- **`routes/staff.js`** — `PUT /:id` was registered before `PUT /permissions`, so saving
  permissions hit `updateStaff` (500). Reordered static routes before `/:id`.
- **`controllers/guestsController.js`** — `createGuest`/`updateGuest` passed JS arrays to the
  JSON-string columns `tags`/`amenities`/`facilities` → Prisma 500. Now `JSON.stringify`-ed.
- **`controllers/documentsController.js`** — `getDocuments` now also selects
  `idType`/`idNumber`/`room.number` for the KYC table.
- **`store/slices/authSlice.js`** — post-login `activePanel` was `dashboard` (not in the
  5-panel scope) → "Access Restricted" landing. Now `bookings`.
- **`app.js`** — `authLimiter` (10 auth req / 15 min) locked out local E2E runs. Now generous
  in non-production, unchanged in production.

### Test harness
- Playwright in `client/` (config at root; specs in gitignored `client/tests/`).
- `npm run test:e2e` runs against the already-running dev stack (no mock mode).
- Tests self-seed data via the API where the DB is empty (`ensureGuest` helper).

### Missing backend endpoints — frontend-only features

These features have a **working UI but no backend endpoint**, so they currently run on
local/illustrative data only. Listed with the endpoint(s) the backend team would need to add
for each to become real. (None of these are wired to the API — they are intentionally left
local until the endpoints exist.)

| Feature (frontend-only) | Where in UI | Missing backend endpoint(s) | Notes |
|---|---|---|---|
| **Account Ledger** | Billing → *Ledger* tab | `GET /billing/ledger?guestId=` → per-guest debit/credit entries + running/closing balance | UI builds the ledger from mock; no ledger table/endpoint exists |
| **Cash Register** | Billing → *Cash Register* tab | `GET /billing/cash-register?date=` (collections/advances/refunds for the day) + opening/closing balance | No cash-transaction model/endpoint |
| **Message Templates (create)** | Settings → *Notifications* tab | `POST /reminders/templates` (create) + seed defaults; optional `label`/`delay` columns on `MessageTemplate` | `GET /reminders/templates` and `PUT /reminders/templates/:id` exist, but the table is unseeded and has **no create route**, so the tab can't add/edit templates |
| **Competitor rate benchmarking** | Settings → *Pricing Rules* tab | `GET/POST/PUT/DELETE /pricing/competitors` | Pricing **rules** are wired (`/pricing/rules`); only the competitor table is local |
| **Staff sessions / force-logout** | Staff → *All Staff* (Force Logout) | `GET /staff/:id/sessions`, `POST /staff/:id/logout` (terminate) | `StaffSession` model exists in schema but has no controller/route; indicator is client-only |
| **Guest communications log** | Guests → profile *Communications* tab + “Log Communication” | `GET /guests/:id/communications`, `POST /guests/:id/communications` | `commLog` is hard-set to `[]`; no comms model/endpoint |
| **Renew stay** | Guests table → *Renew* (Due guests) | `POST /guests/:id/renew` (extend stay / new period) | Button currently only toasts |
| **PDF exports** | Reports → *Export* | `GET /reports/export/pdf?type=` | Only CSV export exists (`/reports/export/csv`, wired); PDF buttons were removed pending an endpoint |
| **Occupancy history / heatmap, monthly revenue** | Reports (removed) | `GET /reports/occupancy?from=&to=` (daily series), monthly grouping on `/reports/revenue` | Random-mock charts were **removed**; Reports now shows only real data (revenue-by-day, GST, current occupancy by room type) |

### Inverse gap — backend exists, frontend UI missing
- **Maintenance preventive schedule** — `GET /maintenance/schedule` + `POST /maintenance/schedule`
  exist and `maintenanceApi.schedules`/`createSchedule` helpers are added, but there is **no UI
  tab** in `Maintenance.jsx` yet. (This is the only remaining build-the-UI item; everything else
  above is build-the-endpoint.)
