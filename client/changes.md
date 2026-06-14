# Changes Log — Quantum Vorvex Frontend

All changes made in this session to the Quantum Vorvex frontend.

Folder: `quantumvorvex-main/client/`

---

# Session — 2026-06-14 · RBAC Phase 1 — Users & Roles panel (Staff module removed)

## Summary
Replaced the dead **Staff** module with a dedicated **Users & Roles** panel backed by the new
backend Role / RolePermission API. The sidebar's "Staff" slot is now "Users & Roles": a Users tab
(create/edit/deactivate/delete with a role dropdown; password optional → defaults to `Welcome@123`)
and a Roles tab (create/edit roles with a per-module **None/View/Manage** matrix; Owner read-only,
system roles protected). Role management is owner-only. Also removed the now-duplicate Settings →
"Users & Access" tab. **Permissions are not yet enforced per-route** (Phase 2) — the sidebar still
gates by the legacy role string for now. Backend logged in `../server/CHANGES.md`.

## File changes

### `src/components/modules/users/UsersRoles.jsx` (new)
- The Users & Roles panel. Tabs: **Users** (table + add/edit modal via Formik, role dropdown, optional
  password with a `Welcome@123` hint; toasts the default password on create) and **Roles** (role cards
  with their module badges + a create/edit modal containing the module×level matrix). Owner-only
  controls (`canManage = currentUser.role === 'owner'`); Owner role shown read-only.

### `src/validation/userSchema.js` (new)
- Yup schema for the user form — password optional (blank → server default), strength-checked when set.

### `src/api/client.js`
- Removed `staffApi`. Added `rolesApi` (`getAll`, `getModules`, `create`, `update`, `remove`).

### `src/utils/navigation.js`
- Renamed the Administration nav item `staff` → `users` ("Users & Roles", same `LuUserCog` icon).

### `src/utils/permissions.js`
- `ADMIN_PANELS` `['staff']` → `['users']`. Removed the `users` Settings tab from `ROLE_SETTINGS_TABS`
  (user/role management now lives in the dedicated panel, not Settings).

### `src/App.jsx`
- Swapped the lazy `Staff` import + `PANEL_MAP` entry for `UsersRoles` under the `users` key.

### `src/hooks/useKeyboardShortcuts.js`
- Shift+S now navigates to the `users` panel (was `staff`).

### `src/components/modules/settings/Settings.jsx`
- Removed the **"Users & Access"** tab: dropped it from `ALL_TABS`, removed its render block, and deleted
  the `UsersAccessTab` component + `EMPTY_USER_FORM` (~280 lines). Bundle ~95 kB → ~86 kB.

### `tests/users-roles.spec.js` (new)
- Playwright coverage (5 tests): owner sees "Users & Roles" (no "Staff"); panel lists seeded users +
  roles; owner creates a role then a user (sees the `Welcome@123` default); staff can't see the panel;
  Settings no longer has "Users & Access".

### Deleted
- `src/components/modules/staff/Staff.jsx`, `src/validation/staffSchema.js`.

---

# Session — 2026-06-12 · Guest Maintenance Tickets via In-Room QR Code

## Summary
Guests can now report a maintenance issue by scanning a QR code in their room — no login, no app.
Each room has a unique `qrToken`; the QR points to `/report?t=<token>`, a standalone public page that
resolves the room, lets the guest pick a category and describe the issue, and files a ticket straight
into the existing staff Maintenance dashboard (flagged `Guest – Room <n>`). Staff generate/print the
per-room QR sticker from the Rooms module.

## File changes

### `src/components/modules/maintenance/GuestMaintenanceForm.jsx` (new)
- Mobile-first public page reached at `/report?t=<token>`. Reads the token from the URL, calls
  `maintenanceApi.getPublicRoom` to confirm the room, then submits via `maintenanceApi.createPublic`.
  Shows a thank-you screen with the ticket reference. No auth, rendered outside the app shell.

### `src/App.jsx`
- Added a `reportRoute` early-return (mirrors the existing `resetRoute` pattern) so `/report` renders
  `GuestMaintenanceForm` before any authentication gate.

### `src/api/client.js`
- Added `maintenanceApi.getPublicRoom(token)` and `maintenanceApi.createPublic(data)` hitting the new
  public `/maintenance/public/*` endpoints.

### `src/components/modules/rooms/Rooms.jsx`
- Added a **Maintenance QR** action in the room detail modal that opens a printable sticker
  (`QRCodeSVG` from `qrcode.react`) encoding `<origin>/report?t=<qrToken>`, with a print-sticker button.
- `normalizeRoom` now carries `qrToken` through from the API.

### `package.json`
- Added `qrcode.react` dependency.

---

# Session — 2026-06-12 · Fold Check-In & Check-Out into Bookings + Today

## Summary
The Front Desk nav had three separate items — **Bookings**, **Check-In**, **Check-Out** — but Check-In
and Check-Out were just filtered views of the bookings list (`status ∈ {Confirmed, Pending}` and
`status = CheckedIn`) using actions the Bookings table already exposes inline, and the **Today** board
already surfaced the same arrivals/departures. Removed the two redundant screens. Bookings is now the
single reservation surface; Today is the daily front-desk board and deep-links into the relevant
Bookings status tab. New model: **Today = "what do I do now," Bookings = the reservation record.**

## File changes

### `src/store/slices/uiSlice.js`
- Added `activePanelParams` to state and a `navigateTo({ panel, params })` action that switches panel
  while handing params (e.g. `{ tab: 'CheckedIn' }`) to the incoming page. Plain `setActivePanel` now
  clears the params so a direct nav resets to defaults.

### `src/store/hooks.js`
- Bound `navigateTo` in `useUiActions`.

### `src/utils/navigation.js`
- Removed the `checkin` and `checkout` Front Desk items (and the now-unused `LuLogIn` / `LuLogOut`
  imports). Front Desk is now `Bookings · Cancellations · Maintenance`.

### `src/utils/permissions.js`
- Dropped `checkin` / `checkout` from `FRONT_DESK_PANELS` (old `/checkin` URLs now fall back to Today).

### `src/App.jsx`
- Removed the `CheckIn` / `CheckOut` lazy imports and their `PANEL_MAP` entries.

### `src/components/layout/Topbar.jsx`
- Removed the `checkin` / `checkout` contextual primary actions.

### `src/components/modules/today/Today.jsx`
- Added a `goBookings(tab)` helper (via `navigateTo`). KPI strip, the Arrivals/Departures column
  "view" links, the per-row Check-in/Check-out actions, and the "Overdue checkouts" attention row now
  deep-link to Bookings (`Upcoming` for arrivals, `CheckedIn` for departures/in-house) instead of the
  standalone desks.

### `src/components/modules/bookings/Bookings.jsx`
- Reads `activePanelParams.tab` (validated against the tab ids) to seed the active tab and follows it
  via an effect, so a deep-link from Today/Guests lands on the right status tab.

### `src/components/modules/guests/Guests.jsx`
- "+ Check-In" button now `navigateTo`s Bookings `Upcoming` instead of the removed `checkin` panel.

### `src/hooks/useKeyboardShortcuts.js`
- Repointed the `C` shortcut from `checkin` → `bookings` (updated the legend comment too).

### `src/components/ui/GlobalSearch.jsx`
- Removed the `Check-In` quick-nav entry.

### Deleted
- `src/components/modules/checkin/CheckIn.jsx`, `src/components/modules/checkin/ArrivalCard.jsx`,
  `src/components/modules/checkout/CheckOut.jsx`. Kept `checkout/CheckOutModal.jsx` — Bookings uses it.

## Notes
- `npm run build` passes; the CheckIn/CheckOut chunks are gone, Bookings remains.
- Watch point: Today's *Departures* derive from `guests` (status `checked_in`) while the Bookings
  `CheckedIn` tab derives from `bookings` — same real-world set, two data sources, so they can drift.

---

# Session — 2026-06-13 · Settings tabs — real persistence for all tabs

## Summary
Audited all 13 Settings tabs. 8 already persisted (Hotel Profile, Room Config, Facilities, Food Plans,
Tax & Pricing, Pricing Rules, Notifications, Users & Access). The remaining 5 only toasted "saved" —
now wired to persist through `settingsApi` (backed by new `hotel` JSON columns). Each tab hydrates from
the loaded settings and saves with loading/error states.

## File changes

### `src/components/modules/settings/Settings.jsx`
- **Documents tab** — KYC checklist + expiry-reminder days now load from / save to
  `hotel.documentsConfig` (JSON). Save button calls `settingsApi.update`.
- **Branding tab** — tagline / login title / footer / logo persist to `hotel.branding` (JSON) in
  addition to the existing localStorage cache (so the login screen still picks them up); hydrates
  backend → localStorage on load.
- **Preferences tab** — regional + notification/session prefs persist to `hotel.preferences` (JSON);
  same backend-wins-over-cache hydration. Now receives `settings` prop.
- **Appearance tab** — accent / density / corner-radius persist to `hotel.appearance` (JSON) on Save
  (still applies live as you tweak); hydrates + re-skins from the saved blob. Now receives `settings`.
- **Properties tab** — "Save Property" now persists the editable hotel fields via `settingsApi.update`
  (+ updates the store's hotel/owner name) instead of a no-op toast. (Multi-property table is still the
  intentional "Upgrade to Pro" paywall — left gated.)
- All five `SaveButton`/buttons now show a `Saving…` state.

---

# Session — 2026-06-13 · Frontend-only features wired to new backend APIs

## Summary
The 9 "missing backend endpoint" features from `docs/FRONTEND_API_PLAN.md` (working UI on mock/local
data) are now wired to real endpoints. Added API helpers + mock entries, then swapped each UI from
local data to the API.

## File changes

### `src/api/client.js`
- `billingApi`: `getLedger`, `getCashRegister`.
- `guestsApi`: `renew`, `getCommunications`, `addCommunication`.
- `reportsApi`: `getOccupancy`, `exportPdf`.
- `staffApi`: `getSessions`, `forceLogout`.
- `pricingApi`: `getCompetitors`, `createCompetitor`, `updateCompetitor`, `deleteCompetitor`.
- `remindersApi`: `createTemplate`.

### `src/api/mockData.js`
- Added mock data + route handlers for ledger, cash-register, occupancy, PDF export, guest
  communications, guest renew, staff sessions/logout, pricing competitors, and reminder templates.

### `src/components/modules/billing/Billing.jsx`
- **Ledger tab** — guest dropdown now from `guestsApi.getAll`; ledger from `billingApi.getLedger`
  (was hardcoded `MOCK_LEDGER`). **Cash Register tab** — fetches `billingApi.getCashRegister(date)`
  (was `MOCK_CASH_TXN`). Removed the now-dead mock constants; added loading/empty states.

### `src/components/modules/reports/Reports.jsx`
- **Occupancy tab** — added a live daily-occupancy trend chart + by-room-type table from
  `reportsApi.getOccupancy` (falls back to deriving from rooms). **Export tab** — added PDF export
  buttons alongside CSV via `reportsApi.exportPdf`.

### `src/components/modules/staff/Staff.jsx`
- Loads real active-session counts per member; **Force Logout** calls `staffApi.forceLogout` (was a
  local-only indicator clear).

### `src/components/modules/guests/Guests.jsx`
- **Communications tab** — fetches `guestsApi.getCommunications` and logs entries via
  `addCommunication` (channel picker + composer); was a hardcoded empty `commLog`.
- **Renew** button now calls `guestsApi.renew` (was a toast-only stub).

### `src/components/modules/settings/Settings.jsx`
- **Pricing Rules tab** — Competitor Rate Benchmarking now loads/creates/updates/deletes via
  `pricingApi.*competitor*` (persist on blur/change; add/delete hit the API); was local-only.
- **Notifications tab** — message templates load from `remindersApi.getTemplates` (seeds the default
  set on first run if empty), edit persists via `updateTemplate`, active toggle persists; was local.

### `package.json`
- Installed the already-declared-but-missing `qrcode.react` dependency (Rooms.jsx import was breaking
  the production build).

---

# Session — 2026-06-12 · Guest Maintenance Tickets via In-Room QR Code

## Summary
Guests can now report a maintenance issue by scanning a QR code in their room — no login, no app.
Each room has a unique `qrToken`; the QR points to `/report?t=<token>`, a standalone public page that
resolves the room, lets the guest pick a category and describe the issue, and files a ticket straight
into the existing staff Maintenance dashboard (flagged `Guest – Room <n>`). Staff generate/print the
per-room QR sticker from the Rooms module.

## File changes

### `src/components/modules/maintenance/GuestMaintenanceForm.jsx` (new)
- Mobile-first public page reached at `/report?t=<token>`. Reads the token from the URL, calls
  `maintenanceApi.getPublicRoom` to confirm the room, then submits via `maintenanceApi.createPublic`.
  Shows a thank-you screen with the ticket reference. No auth, rendered outside the app shell.

### `src/App.jsx`
- Added a `reportRoute` early-return (mirrors the existing `resetRoute` pattern) so `/report` renders
  `GuestMaintenanceForm` before any authentication gate.

### `src/api/client.js`
- Added `maintenanceApi.getPublicRoom(token)` and `maintenanceApi.createPublic(data)` hitting the new
  public `/maintenance/public/*` endpoints.

### `src/components/modules/rooms/Rooms.jsx`
- Added a **Maintenance QR** action in the room detail modal that opens a printable sticker
  (`QRCodeSVG` from `qrcode.react`) encoding `<origin>/report?t=<qrToken>`, with a print-sticker button.
- `normalizeRoom` now carries `qrToken` through from the API.

### `package.json`
- Added `qrcode.react` dependency.

---

# Session — 2026-06-12 · Fold Check-In & Check-Out into Bookings + Today

## Summary
The Front Desk nav had three separate items — **Bookings**, **Check-In**, **Check-Out** — but Check-In
and Check-Out were just filtered views of the bookings list (`status ∈ {Confirmed, Pending}` and
`status = CheckedIn`) using actions the Bookings table already exposes inline, and the **Today** board
already surfaced the same arrivals/departures. Removed the two redundant screens. Bookings is now the
single reservation surface; Today is the daily front-desk board and deep-links into the relevant
Bookings status tab. New model: **Today = "what do I do now," Bookings = the reservation record.**

## File changes

### `src/store/slices/uiSlice.js`
- Added `activePanelParams` to state and a `navigateTo({ panel, params })` action that switches panel
  while handing params (e.g. `{ tab: 'CheckedIn' }`) to the incoming page. Plain `setActivePanel` now
  clears the params so a direct nav resets to defaults.

### `src/store/hooks.js`
- Bound `navigateTo` in `useUiActions`.

### `src/utils/navigation.js`
- Removed the `checkin` and `checkout` Front Desk items (and the now-unused `LuLogIn` / `LuLogOut`
  imports). Front Desk is now `Bookings · Cancellations · Maintenance`.

### `src/utils/permissions.js`
- Dropped `checkin` / `checkout` from `FRONT_DESK_PANELS` (old `/checkin` URLs now fall back to Today).

### `src/App.jsx`
- Removed the `CheckIn` / `CheckOut` lazy imports and their `PANEL_MAP` entries.

### `src/components/layout/Topbar.jsx`
- Removed the `checkin` / `checkout` contextual primary actions.

### `src/components/modules/today/Today.jsx`
- Added a `goBookings(tab)` helper (via `navigateTo`). KPI strip, the Arrivals/Departures column
  "view" links, the per-row Check-in/Check-out actions, and the "Overdue checkouts" attention row now
  deep-link to Bookings (`Upcoming` for arrivals, `CheckedIn` for departures/in-house) instead of the
  standalone desks.

### `src/components/modules/bookings/Bookings.jsx`
- Reads `activePanelParams.tab` (validated against the tab ids) to seed the active tab and follows it
  via an effect, so a deep-link from Today/Guests lands on the right status tab.

### `src/components/modules/guests/Guests.jsx`
- "+ Check-In" button now `navigateTo`s Bookings `Upcoming` instead of the removed `checkin` panel.

### `src/hooks/useKeyboardShortcuts.js`
- Repointed the `C` shortcut from `checkin` → `bookings` (updated the legend comment too).

### `src/components/ui/GlobalSearch.jsx`
- Removed the `Check-In` quick-nav entry.

### Deleted
- `src/components/modules/checkin/CheckIn.jsx`, `src/components/modules/checkin/ArrivalCard.jsx`,
  `src/components/modules/checkout/CheckOut.jsx`. Kept `checkout/CheckOutModal.jsx` — Bookings uses it.

## Notes
- `npm run build` passes; the CheckIn/CheckOut chunks are gone, Bookings remains.
- Watch point: Today's *Departures* derive from `guests` (status `checked_in`) while the Bookings
  `CheckedIn` tab derives from `bookings` — same real-world set, two data sources, so they can drift.

---

# Session — 2026-06-10 · Invoice preview modal + PDF download

## Summary
The Bookings invoice button blindly opened the invoice HTML in a new tab (or downloaded `.html` when
pop-ups were blocked). Replaced it with an in-app preview modal that shows the invoice in an iframe and
offers Print + Download — and the download is now a real **PDF** rendered by the backend (see
`../server/CHANGES.md`), not raw HTML.

## File changes

### `src/components/modules/bookings/InvoiceModal.jsx` (new)
- Fetches the invoice HTML via `bookingsApi.getInvoice(id)` (authenticated blob) and previews it in an
  `<iframe>` using a blob object URL; revokes the URL on close.
- **Print** — calls `contentWindow.print()` on the loaded preview (same-origin blob, no pop-up needed).
- **Download PDF** — fetches `getInvoice(id, { format: 'pdf' })` and saves `invoice-<bookingNo>.pdf`,
  with a "Preparing PDF…" button state and a toast on failure.
- Shared `errorMessage()` helper parses the API's blob error bodies into a readable message.

### `src/components/modules/bookings/Bookings.jsx`
- Removed the old `handleInvoice` (new-tab/HTML-download). The invoice button now opens the modal
  (`onInvoice={setInvoiceTarget}`); rendered `<InvoiceModal>` alongside the other modals.

### `src/components/ui-tw/Modal.jsx`
- Added an `xl` size (`max-w-5xl`) so the invoice preview has room.

## Notes
- Preview is fast HTML-in-iframe; only the Download fetches the (slower) server-rendered PDF on click.
- Replaces the unauthenticated `invoiceUrl` open path — preview/print/download all go through the
  authenticated API client now.

---

# Session — 2026-06-10 · URL-based routing for Settings tabs

## Summary
The Settings sub-tabs were local state, so they weren't addressable and a refresh always dropped back
to Hotel Profile. Each tab is now reflected in the URL as a query param (e.g. `/settings?tab=rooms`),
so tabs are deep-linkable, shareable, and survive a refresh.

## File changes

### `src/components/modules/settings/Settings.jsx`
- Added `tabFromUrl()` (reads/validates `?tab=` against the known tab ids) and seeded `activeTab` from
  it instead of the hardcoded `'profile'`.
- Effect keeps `?tab=` in sync with the active tab using **`replaceState`** — keeps the page
  addressable without spamming back-button history (back leaves Settings to the previous panel).
- `popstate` listener re-reads the tab on browser back/forward.
- Invalid / role-inaccessible / missing tab normalizes to the first allowed tab (reuses the existing
  `validActiveTab` fallback) and rewrites the URL to match.

### `tests/settings-tabs.spec.js`
- New test: deep-link `/settings?tab=tax` opens Tax; switching to Room Config updates the URL to
  `?tab=rooms`; refresh restores it; bare `/settings` normalizes to `?tab=profile`.

## Notes
- Chose a **query param** over a path segment (`/settings/rooms`) deliberately: the app's panel router
  keys off `location.pathname` only (always `/settings` here) and its sync effect early-returns when
  the pathname already matches — so a query param is invisible to it and needs **no change to the
  global panel navigation**. A path segment would have required reworking `panelFromUrl` + the App URL
  effect for every panel.

---

# Session — 2026-06-10 · Check-out: payment method, reference + screenshot, shared modal

## Summary
The check-out form only let staff add extra charges and a collection amount — it didn't record **how**
the guest paid or let them attach proof. Added a payment-method selector, a reference field, and an
optional payment-screenshot upload to the check-out modal. Also fixed the Bookings page, where the
**Check-out** button bypassed the modal and checked out directly — it now opens the same modal.

## File changes

### `src/components/modules/checkout/CheckOutModal.jsx`
- Added a **Payment method** dropdown (Cash / Card / UPI / Bank transfer / Cheque / Other), disabled
  until a collection amount is entered, defaulting to Cash and resetting per booking.
- Added a **Reference / txn no.** field shown only for non-cash methods while collecting.
- Added an optional **Payment screenshot / proof** upload (image or PDF) with a 10MB client guard
  matching the server limit, a selected-file chip with a Remove action, and an inline error.
- `onConfirm` payload now carries `paymentMethod`, `paymentReference`, and `proofFile`.

### `src/components/modules/checkout/CheckOut.jsx`
- `handleCheckOut` now forwards `paymentMethod` / `paymentReference` to `bookingsApi.checkOut`, and
  uploads the screenshot first (as a `payment_proof` booking document) so a failed upload aborts the
  check-out instead of orphaning the proof.

### `src/components/modules/bookings/Bookings.jsx`
- The table's **Check-out** button now opens `CheckOutModal` (`onCheckOut={setCheckOutTarget}`) instead
  of calling the API immediately.
- Rewrote `handleCheckOut` to consume the modal payload (upload proof → `checkOut` → update the row in
  place so it moves to the Checked Out tab). Rendered `<CheckOutModal>` with `submitting` tied to `busyId`.

## Notes
- Reuses the existing `POST /bookings/:id/documents` route for the screenshot — no new client API.
- Payment proofs land in the local `uploads/` disk like other docs (pending the planned S3 migration).

---

# Session — 2026-06-10 · Wire Settings tabs to the real API + logo cropping

## Summary
The Settings page was mostly UI scaffolding — only Pricing Rules and Users & Access talked to the
backend; the rest saved to in-memory state or `localStorage`. Wired every tab whose backend model
already exists (Hotel Profile, Tax & Pricing, Room Config, Food Plans, Facilities/amenities) plus
logo upload to the existing `settingsApi`. Also fixed the logo disappearing on refresh and added a
proper crop step (pan/zoom, 1:1) before uploading — on both Hotel Profile and Branding.

## File changes

### `src/components/modules/settings/Settings.jsx`
- **Load contract fixed:** the mount effect read `data.settings`, but the controller returns
  `{ hotel, roomTypes, foodPlans, amenities }` — so nothing loaded against the real server. Now reads
  the real shape via `settingsApi.get()` and distributes it.
- **Lifted shared state:** `roomTypes` / `foodPlans` / `amenities` now live in the `Settings` root and
  pass down to their tabs, so rows carry real DB `cuid`s.
- **Field renames to match Prisma** (state keys, handlers, JSX): `hotelName→name`,
  `peakDaily→peakDailyRate`, `peakMonthly→peakMonthlyRate`, `oneTime→oneTimeRate`,
  `weekly→weeklyRate`, `desc→description`, `daily→dailyRate`, `monthly→monthlyRate`.
- **Save handlers wired** for Hotel Profile / Tax & Pricing / Room Config / Food Plans / Facilities →
  `settingsApi.update(slice)` with success/error toasts; shared `SaveButton` shows a "Saving…" state.
- **`stripForSave` / `isPersistedId`:** an id is sent only when it's a real cuid (so new rows and the
  local seed defaults upsert by name instead of failing an update-by-id); drops UI-only fields (`count`).
  New rows get a temporary `new-…` id used only as the React key.
- UI-only fields with no DB column kept local: `totalRooms`, `floors`, `seasonalPricing`, the
  Facilities free-text chip list.
- **Logo persistence fix:** preview was seeded once via `useState(settings.logoUrl)` before the async
  GET resolved, so it vanished on refresh. Now renders `logoPreview || settings.logoUrl`.
- **Cropper:** added a reusable `LogoCropModal` (pan/zoom, 1:1, configurable shape/labels, keyed by
  `src` to reset per image). Hotel Profile uploads the cropped square to `POST /settings/logo`;
  Branding crops to a base64 data URL stored in `localStorage` (unchanged persistence model).

### `src/api/mockData.js`
- Reshaped the flat `SETTINGS` into `SETTINGS_HOTEL` + `SETTINGS_ROOM_TYPES` / `_FOOD_PLANS` /
  `_AMENITIES` with DB field names; `GET /settings` now returns `{ hotel, roomTypes, foodPlans,
  amenities }` and `PUT /settings` returns the success message — keeps `VITE_MOCK=true` consistent.

### `src/utils/cropImage.js` (new)
- `getCroppedBlob(src, pixelCrop)` — canvas crop → normalized 512×512 PNG Blob.
- `blobToDataUrl(blob)` — Blob → base64 data URL (for the localStorage-stored Branding logo).

### `tests/settings-tabs.spec.js` (new) + `tests/helpers.js`
- New Playwright suite (real backend): edit round-trips with restore for each wired tab, logo
  upload+crop+reload persistence, Branding local crop, and an add/delete flow exercising the temp-id
  handling. Round-trips assert against the fresh `GET /settings` body (deterministic, avoids
  controlled-input timing flakes).
- `helpers.js` — scoped `login()`/`openPanel()` selectors to `#sidebar`; the new topbar also renders a
  "Front Desk" label, which broke the old `getByText` (strict-mode, two matches).

## Notes
- Added dependency: **`react-easy-crop`** (`package.json`/lockfile).
- Pairs with the server delete-diff change (see `../server/CHANGES.md`) so removing a row persists.
- Hotel Profile and Branding still hold **two separate logos** (server `logoUrl` vs localStorage
  base64). Consolidating onto one server logo is a possible follow-up.

---

# Session — 2026-06-10 · Proxy /uploads so document links resolve in dev

## Summary
Document/logo links (`/uploads/...`) resolved against the Vite dev server (5173), which has no such
files, so opening a document 404'd. The Vite proxy only forwarded `/api` to the backend.

## File changes

### `vite.config.js`
- Added a `/uploads` proxy entry pointing at the backend (`http://localhost:5001`, `changeOrigin`),
  mirroring the existing `/api` proxy. Now uploaded files served by the backend's
  `express.static('/uploads')` resolve in dev.

## Notes
- Requires a Vite dev-server restart (proxy config isn't hot-reloaded).
- Also fixes logo uploads, which use the same `/uploads/...` path scheme.
- Production: only works if frontend and backend share an origin. If split across domains, return
  absolute upload URLs instead. See the object-storage migration follow-up.

---

# Session — 2026-06-10 · Topbar breadcrumb (remove duplicate page heading)

## Summary
- Every page showed its title twice — a big topbar title plus the module's own in-page heading
  (e.g. "reports" above "Reports & Analytics"). The topbar title is now a compact breadcrumb
  (`Section › Page`, e.g. `Finance › Reports`), leaving each page with a single real heading.
- Also fixes the topbar showing the raw panel id (lowercase "reports") — its old label map only
  covered the six front-desk panels.

## File changes

### `src/utils/navigation.js` (new)
- `NAV_SECTIONS` moved here from `Sidebar.jsx` — single source of truth for the nav structure
  (sections, panel ids, labels, icons).
- `PANEL_META` derived from it: panel id → `{ label, section }` lookup for the breadcrumb.

### `src/components/layout/Sidebar.jsx`
- Imports the shared `NAV_SECTIONS` instead of its own local copy (no visual change).

### `src/components/layout/Topbar.jsx`
- Removed the local 6-panel `PANEL_LABELS` map; uses `PANEL_META` (all panels) instead.
- Replaced the `t-h2` page title with a breadcrumb: muted section name › current page
  (slightly heavier text), date below as before. The section crumb is plain text (sections
  aren't pages). Panels outside the nav structure fall back to a capitalized page name with
  no section crumb.

## Notes
- Sidebar and breadcrumb can no longer drift apart when adding a panel (shared structure).
- Verified with a green `npm run build`.

---

# Session — 2026-06-10 · URL-based panel navigation (refresh keeps the page)

## Summary
- Panels were pure Redux state (`ui.activePanel`) — the URL never changed, so a refresh always
  reset to the default panel. Each panel now has its own path (`/bookings`, `/rooms`, …):
  refresh restores the page, back/forward work, and panel links are shareable/bookmarkable.
  No react-router adoption needed — all navigation already funnels through `setActivePanel`.

## File changes

### `src/store/slices/uiSlice.js`
- New exported helper `panelFromUrl(fallback)` — maps `window.location.pathname` to a panel id
  (e.g. `/rooms` → `rooms`), validated against the full panel list (`ROLE_PANELS.owner` from
  `utils/permissions.js`); returns `fallback` for unknown paths.
- `initialState.activePanel` now initializes from `panelFromUrl('today')` instead of the
  hardcoded `'today'` — this is the actual refresh fix.

### `src/App.jsx`
- State → URL effect: whenever `activePanel` changes (authenticated only, and not on the
  `/reset-password` deep link), the address bar is updated to `/<panel>` — `replaceState` when
  normalizing a non-panel path like `/` (no junk history entry), `pushState` otherwise.
- URL → state effect: `popstate` listener dispatches `setActivePanel(panelFromUrl('today'))` so
  browser back/forward switch panels.

### `src/store/slices/authSlice.js`
- `login` thunk — previously always forced `setActivePanel('bookings')`; now
  `setActivePanel(panelFromUrl('bookings'))`, so a deep link opened while logged out
  (e.g. `/rooms`) is honoured after sign-in.

## Notes
- Role checks unchanged — a staff user opening `/billing` still gets the Access Restricted screen.
- Vite dev server already falls back to `index.html` for panel paths; the **production** host
  needs an SPA fallback (serve `index.html` for unknown paths) or refreshing on `/rooms` 404s.
- Verified with a green `npm run build`.

# Session — 2026-06-10 · Single-session 401 handling (logged-in-elsewhere notice)

## Summary
Frontend half of the "one active session per user" feature (backend logged in
[../server/CHANGES.md](../server/CHANGES.md)). When the server signs a device out because the
account logged in elsewhere, the user now sees an explanatory banner on the login screen instead
of a silent logout.

## File changes

### `src/api/client.js`
- 401 response interceptor — for session-specific codes (`ERR_SESSION_SUPERSEDED` = logged in
  elsewhere, or `ERR_SESSION_EXPIRED` = old/migrated token needing a fresh login), stash the
  server's reason message in `sessionStorage` (`qv_logout_reason`) before triggering the existing
  `auth:unauthorized` logout flow. Other 401s behave exactly as before.

### `src/components/auth/LoginPage.jsx`
- Read `qv_logout_reason` once via a lazy `useState` initializer (read-and-clear; avoids a
  `set-state-in-effect` lint violation and avoids persisting the notice in Redux).
- Render an amber notice banner (Tailwind) at the top of the login card when a reason is present:
  "You were signed out because your account logged in on another device."

## Notes
- The interceptor already exempts `/auth/*` calls, so a wrong password on the login form still
  surfaces as a field error, not the logout banner.

# Session — 2026-06-10 · Collapsed-sidebar tooltips

## Summary
- The collapsed (desktop) sidebar showed only icons with no indication of which tab was which —
  the native `title` tooltip was unreliable/slow. Added an instant custom tooltip showing the
  tab label on hover.

## File changes

### `src/components/layout/Sidebar.jsx`
- `NavItem` — replaced the native `title` attribute with a custom styled tooltip rendered on
  hover when `collapsed`:
  - Dark pill (`#1f1f1f`, white 12px label, subtle border + shadow) with a small arrow pointing
    at the icon, matching the sidebar's dark/gold theme.
  - Uses `position: fixed` with coordinates measured via `getBoundingClientRect()` on
    mouse-enter — required because the sidebar has `overflow-x-hidden`, which would clip an
    absolutely-positioned tooltip.
  - Added `aria-label={item.label}` on collapsed items so screen readers still announce the tab
    name (the icon has no visible text when collapsed).
- The footer "Sign Out" button and avatar keep their existing native `title` tooltips (unchanged).

---

# Session — 2026-06-04 · Real-backend integration + Playwright E2E

Backend-specific changes for this session are logged in [../server/CHANGES.md](../server/CHANGES.md).
Paths below are relative to `client/`.

## Summary
- Connected **9 orphaned modules** from local/mock data to the **real backend** (no mock mode),
  mounted them in the sidebar with role-based access, and covered each with Playwright E2E tests
  against the live stack (frontend :5173 + backend :5000).
- Set up the **Playwright** harness from scratch — **27 E2E tests pass**; production build green.

## 1. New API client helpers — `src/api/client.js`
- `housekeepingApi` — `getBoard`, `updateStatus`, `getDaily`, `getLinen`, `markLinen`, `submitInspection`
- `staffApi` — `getAll`, `create`, `update`, `getActivity`, `getPermissions`, `updatePermissions`
- `usersApi` — `getAll`, `create`, `update`, `remove`
- `pricingApi` — `getRules`, `saveRules`, `compute`
- `remindersApi` — `send`, `getTemplates`, `updateTemplate`
- `foodApi` — added `createPlan`, `updatePlan`, `deletePlan`
- `maintenanceApi` — added `createSchedule`

## 2. Modules wired to the real API (mock → real)
| Module | File | Real wiring |
|---|---|---|
| Housekeeping | `src/components/modules/housekeeping/Housekeeping.jsx` | board read, room status PUT, linen, inspection submit |
| Guests | `src/components/modules/guests/Guests.jsx` | list, profile detail fetch, edit (sanitized payload), checkout |
| Rooms | `src/components/modules/rooms/Rooms.jsx` | list, create, status change PUT |
| Documents | `src/components/modules/documents/Documents.jsx` | KYC list, multipart upload, per-document verify |
| Food | `src/components/modules/food/Food.jsx` | plan create/toggle/delete, orders from active guests |
| Billing | `src/components/modules/billing/Billing.jsx` | invoice list, generate (real guestId), collect, remind |
| Reports | `src/components/modules/reports/Reports.jsx` | dashboard KPIs, revenue-by-day, GST, CSV export, occupancy from live rooms (replaced random mock) |
| Staff | `src/components/modules/staff/Staff.jsx` | list, create, update, status toggle, activity, permissions |
| Settings | `src/components/modules/settings/Settings.jsx` | hotel settings load, Pricing-rules load/save (Users tab already real) |

Each module now fetches on mount, shows loading/error states, and persists via the API.

## 3. App shell / navigation / permissions
- `src/App.jsx` — lazy imports + `PANEL_MAP` entries for `housekeeping`, `staff`, `guests`,
  `rooms`, `billing`, `documents`, `food`, `reports`, `settings`.
- `src/components/layout/Sidebar.jsx` — new nav sections **Operations**, **Finance**,
  **Administration** (Front Desk section unchanged).
- `src/utils/permissions.js` — restructured `ROLE_PANELS` into `FRONT_DESK_PANELS` +
  `OPERATIONS_PANELS` + `MANAGER_PANELS` (owner/manager) + `ADMIN_PANELS` (owner).

## 4. Bug fixes (frontend)
- `src/store/slices/authSlice.js` — post-login `activePanel` was `dashboard` (out of scope →
  "Access Restricted"). Changed to `bookings`.
- `src/components/modules/staff/Staff.jsx` — toast calls used the wrong object form
  (`addToast({type, message})`); corrected to `addToast(message, type)`.

## 5. Playwright test harness (new)
- Installed `@playwright/test` 1.60.0 + Chromium.
- `playwright.config.js` — targets `http://localhost:5173`, uses the running dev stack;
  `testDir: ./tests`.
- `tests/` (gitignored) — `helpers.js` (UI login, backend-ready check, `ensureGuest` seeding)
  + specs: `smoke`, `housekeeping`, `staff`, `guests`, `rooms`, `billing`, `documents`, `food`,
  `reports`, `settings`. **27 tests passing.**
- `package.json` — scripts `test:e2e`, `test:e2e:ui`, `test:e2e:report`.
- `.gitignore` — ignore `tests/`, `playwright-report/`, `test-results/`.

## 6. Docs
- `docs/FRONTEND_API_PLAN.md` — created (backend-API-vs-frontend analysis + phased plan),
  then updated with an implementation log + known backend gaps.

## Known gaps (UI present, no backend endpoint — left local/illustrative)
- Billing **Ledger** & **Cash Register** tabs; Settings **Notifications/Templates** (unseeded
  table, no create endpoint); Pricing **competitor benchmarking**; Staff **force-logout/sessions**;
  Maintenance **preventive-schedule** UI (helper added, no tab yet).

## How to run
```bash
# from client/ — backend running with Postgres up + seeded
npm run test:e2e      # 27 E2E tests against the real stack
npm run build         # production build
```

---

# Session — Login page redesign (earlier)

## Objective

1. Disable the marketing landing page and make the login page the default view for unauthenticated users.
2. Redesign the login page to match the Quantum Kairoz login aesthetic (dark split-screen, glassmorphic card, gold `#b07d1a`, Cormorant Garamond + DM Sans + DM Mono fonts, pulsing "System Online" status, gold-bordered feature pills, uppercase sign-in button).
3. Use a real theme-appropriate hotel background image and the shared Kairoz logo.
4. Fix the "half-white" layout bug that was caused by Vorvex's global flex-row `#root` container.

---

## The "half-white, no background" bug

After the initial redesign the login page rendered only on the left half of the viewport and the right half showed the global cream body colour. Root cause:

```css
/* src/index.css */
body  { background: var(--main-bg) /* #f4f4f2 */; overflow: hidden; }
#root { display: flex; height: 100vh; overflow: hidden; }
```

`#root` is a flex-row container designed for the authenticated app shell (sidebar + main content). The login page (`<LoginPage />`) became a flex item that shrank to its intrinsic size instead of filling the viewport, and the cream body colour bled through the unoccupied space on the right.

**Fix** — in [LoginPage.css](src/components/auth/LoginPage.css) on `.login-page`:

```css
flex: 1 1 100%;
width: 100%;
min-width: 0;
min-height: 100vh;
min-height: 100dvh;
overflow: hidden;
```

This forces the login page to claim the full flex row regardless of the global `#root` setup. `index.css` is untouched — the authenticated-app flex layout continues to work as before.

---

## File changes

### `src/App.jsx`

Changes made earlier in this session:

- Commented out the `LandingPage` import (`// import LandingPage from './components/auth/LandingPage'`) — landing component preserved on disk, just unreferenced.
- Commented out the `page === 'landing'` branch that rendered `<LandingPage onLogin={...} />`.
- Removed the `[page, setPage]` state declaration; left a one-line comment marker in its place.
- `<LoginPage />` now renders unconditionally for unauthenticated users, with no `onBack` prop.

### `src/components/auth/LoginPage.jsx` (rewritten, then refined)

Rewritten earlier in this session to mirror Kairoz's `LoginPage.tsx` structure; refined in this pass to add the logo and the real background image:

- Split-screen layout: left brand panel + right floating glass card.
- Inline Lucide-spec SVG icons (`MailIcon`, `LockIcon`, `EyeIcon`, `EyeOffIcon`, `AlertIcon`). `lucide-react` is **not** a Vorvex dependency, so icons are inlined as small SVG components to avoid adding a new package.
- **Added**: `import hotelBg from '../../assets/hotel-bg.jpg'`.
- **Added**: `import goldenLogo from '../../assets/golden_blue_logo.png'`.
- **Changed**: root element now `<div className="login-page" style={{ backgroundImage: url(${hotelBg}) }}>`. The provisional `login-page--vorvex` gradient class was dropped.
- **Changed**: card header now shows the Kairoz logo (`<img className="login-card-logo" ...>`) instead of the provisional gold "Q" monogram tile.
- Left brand panel copy:
  - Eyebrow: "Hotel Management System".
  - Headline: "Seamless Operations. / _Intelligent Control._"
  - Description: unified command centre for rooms, guests, billing, housekeeping.
  - Feature pills: `Check-In`, `Billing`, `Housekeeping`, `Reports`, `AI Insights`.
- Preserves existing `authApi.login({ email, password })` call and `useStore.login(token, user)` action.
- Demo account quick-fill chips (Owner / Manager / Staff) preserved and styled as Kairoz-style bottom-of-card chips.
- The multi-step forgot-password modal from the original component was removed (separate feature surface; can be re-added as its own route later).

### `src/components/auth/LoginPage.css` (refined)

Cloned from Kairoz's `LoginPage.css` earlier in this session; refined in this pass:

- **Added layout-fix block** on `.login-page`: `flex: 1 1 100%; width: 100%; min-width: 0; min-height: 100dvh; overflow: hidden;` — see [The "half-white, no background" bug](#the-half-white-no-background-bug) above.
- **Removed** the provisional `.login-page--vorvex` CSS-gradient rule — the real image now provides the background.
- **Replaced** `.login-card-logo-mark` (gold "Q" monogram tile) with `.login-card-logo` — 340×160 with `brightness(1.3)` filter, matching Kairoz / Kaizen / Eyewall / Optimizer sizing.

### `index.html`

- Appended Cormorant Garamond, DM Sans, and DM Mono to the existing Google Fonts `<link>` tag (Playfair Display, Inter, Syne, JetBrains Mono were already loaded).
- No other changes.

### `src/assets/hotel-bg.jpg` (new asset)

Resort / hotel pool photograph with warm sunset tones and lounge chairs. 1920×1280, ~550 KB, downloaded from Unsplash. Used as the login background image. Fits Quantum Vorvex's hospitality / hotel-management scope.

### `src/assets/golden_blue_logo.png` (new asset)

Copied from `Quantum-Kairoz-main/frontend/src/assets/golden_blue_logo.png` — the same logo used on the Kairoz, Kaizen, Eyewall, and Optimizer login cards. 32 KB.

---

## Design parity with Kairoz

| Token | Value |
|---|---|
| Accent gold | `#b07d1a` (hover `#c9922a`) |
| Status green | `#16A34A` — pulsing dot, "System Online" |
| Error red | `#DC2626` — inline error banner |
| Card | `rgba(255,255,255,0.1)` + `backdrop-filter: blur(24px)` + inset gold glow + deep shadow |
| Overlay | `linear-gradient(105deg, rgba(5,5,12,0.82) 0%, rgba(8,8,18,0.75) 45%, rgba(5,5,12,0.60) 100%)` |
| Serif | Cormorant Garamond 700 (falls back to Playfair Display) |
| Sans | DM Sans 300/400/500/600/700 (falls back to Inter) |
| Mono | DM Mono 400/500 (falls back to JetBrains Mono) |
| Logo size | 340×160 with `filter: brightness(1.3)` |
| Card max-width | 520px desktop, 420px ≤ 768px |
| Breakpoint | 768px — left brand panel hidden below |

---

## Dependencies

No new dependencies installed. Icons are inlined rather than adding `lucide-react`.

---

## Verification performed

- `LoginPage.jsx`, `LoginPage.css` parse cleanly via `esbuild@0.23.1`.
- Import paths resolved:
  - `useStore` from `../../store/useStore` ✓
  - `authApi` from `../../api/client` ✓
  - `hotelBg` from `../../assets/hotel-bg.jpg` ✓
  - `goldenLogo` from `../../assets/golden_blue_logo.png` ✓
- Full `npm run build` / `npm run dev` was not run in this session.

---

## What was not changed

- `LandingPage.jsx` component and its assets are preserved on disk — just unreachable. Re-enable by uncommenting the `LandingPage` import and the `page === 'landing'` branch in `App.jsx` (you would also need to restore the `[page, setPage]` state).
- `src/index.css` was **not** modified — the global `body { background: var(--main-bg) }` and `#root { display: flex }` rules are retained because the authenticated-app shell depends on them. The login page handles the unusual parent layout on its own via the `.login-page` fix.
- No components outside of the login page were restyled.
- No authentication logic / API contract changed; only presentation, copy, assets, and the default unauthenticated view.
- The forgot-password flow is not in this redesign (can be re-added as a separate route/surface later).
