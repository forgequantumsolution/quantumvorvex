# Changes Log — Quantum Vorvex Frontend

All changes made in this session to the Quantum Vorvex frontend.

Folder: `quantumvorvex-main/client/`

---

# Session — 2026-06-21 · Booking room rate is GST-inclusive

## Summary
The room rate in the booking form is now **GST-inclusive** — the total stays equal to what's entered,
and GST is shown extracted from it instead of added on top. Mirrors the server's `computePricing`.

## File changes

### `src/components/modules/bookings/BookingForm.jsx`
- `pricing` preview: `gross = subtotal − discount`, `taxable = gross / (1 + GST%)`,
  `taxAmount = gross − taxable` (rounded to 2dp), `total = gross + extraCharges`.
- Pricing summary now reads **Room charge (incl. GST) → Taxable value → GST (X%) incl. → Total**.

### `src/components/modules/bookings/ExtendStayModal.jsx`
- Extension price preview uses the inclusive total (`gross + extraCharges`) so it matches the server.

### `src/components/modules/billing/Billing.jsx`
- Extended the model to monthly/guest invoices with **only rent GST-inclusive** (food & amenities stay
  GST-on-top). Generate-invoice preview now extracts rent's GST and adds food/amenities' GST, showing
  **Taxable value / GST / Total**. The printed invoice's "Subtotal" row became **Taxable Value** =
  `rent/(1+GST%) + food + amenities`, so Taxable + CGST + SGST = Total reconciles.

### Not changed
- The booking **invoice** (`InvoiceModal`) is a viewer only — all math is server-side.

---

# Session — 2026-06-21 · Extend stay on a booking

## Summary
Added an **Extend** action to active bookings so front-desk staff can push back the check-out date
(daily) or add months (monthly). The new dialog previews the recomputed total and additional amount
due. No backend work — it reuses `PUT /bookings/:id` (`bookingsApi.update`), which already re-checks
room availability and recomputes the stay total + balance.

## File changes

### `src/components/modules/bookings/ExtendStayModal.jsx` (new)
- Focused modal on the shared `Modal` component. Daily stays pick a later check-out date (`min` = day
  after current checkout, enforcing extend-not-shorten); monthly stays add whole months. Live price
  preview mirrors the server's `computePricing` (new length, new total, additional due). Confirm sends
  `{ toDate: <ISO> }` (daily) or `{ months: <new total> }` (monthly).
- **Availability cap (A):** on open (daily), looks up the next live booking on the same room via
  `bookingsApi.getAll({ roomId })` and caps the date picker's `max` to it, with a hint naming the next
  booking ("Room is booked again from … — extend up to then"). Same-day turnover is allowed (new
  checkout may equal the next check-in). Confirm is disabled past the cap, so a clash can't be submitted.

### `src/components/modules/bookings/BookingsTable.jsx`
- Added an `onExtend` prop and a ghost **Extend** button, shown only on `Confirmed`/`CheckedIn` rows.

### `src/components/modules/bookings/Bookings.jsx`
- Added `extendTarget` state, a `handleExtend` that calls `bookingsApi.update(...)` then toasts +
  reloads, wired `onExtend={setExtendTarget}`, and rendered `<ExtendStayModal>` (conditionally, so the
  modal's state re-initialises each open).
- **Named conflict (B):** if the server still rejects with `ERR_ROOM_UNAVAILABLE` (e.g. an active guest
  or a race), the error toast now names the blocker from the response's `conflict` object — booking no.
  + date, or guest name — instead of a generic "unavailable" message.

## Tests
- `tests/extend-stay.spec.js` (new, Playwright): daily extension recomputes via `PUT` (200, nights +
  amount up); the date picker caps to the next booking on the room (A); and the server returns the
  blocking record on a clash for the named-conflict toast (B). Uses a clear-room finder (excludes rooms
  with overlapping bookings or active guests) so runs are deterministic.

---

# Session — 2026-06-21 · Invoice config tab + editable invoice serial

## Summary
Added a new **Invoice** tab in Settings to configure the invoice serial (prefix / next number /
padding), place of supply, bank details, and terms. The invoice preview now shows the serial in an
editable field so it can be overridden per invoice.

## File changes

### `src/components/modules/settings/Settings.jsx`
- New `InvoiceConfigTab` — serial numbering (with a live "next will be …" preview), place of supply,
  bank details, and terms & conditions; saves via `settingsApi.update({ hotel })`. Numeric fields are
  coerced before sending. Added `invoice` to `ALL_TABS` (after Tax & Pricing) and wired its panel.
- Seeded invoice defaults into `initSettings` so inputs are controlled before `GET /settings` loads.

### `src/components/modules/bookings/InvoiceModal.jsx`
- Fetches invoice JSON first (assigns + returns the serial), then the HTML preview, so both share one
  number. Added an editable "Invoice No." field with an Update action → `bookingsApi.updateInvoiceNo`,
  which reloads the preview. Object-URL lifecycle moved to a ref so the refreshed preview doesn't leak.

### `src/api/client.js`
- `bookingsApi.updateInvoiceNo(id, invoiceNo)` → `PATCH /bookings/:id/invoice-no`.

### `src/utils/permissions.js`
- Added `invoice` to the owner and manager settings-tab allow-lists.

---

# Session — 2026-06-20 · Settings: upload stamp & signature for invoices

## Summary
The tax invoice's signature box was just a label ("Signature" + hotel name). Added a way to upload a
combined stamp + authorised-signature image in Settings → Hotel Profile, which then prints in the
invoice signature area. Mirrors the existing logo-upload flow but uploads the image as-is (no crop),
since the stamp is rectangular.

## File changes

### `src/components/modules/settings/Settings.jsx`
- `HotelProfileTab`: added a "Stamp & Signature" uploader below the logo — rectangular preview tile,
  direct upload on file select (no crop modal), stored via `settingsApi.uploadStamp`. Local preview
  falls back to `settings.stampUrl` from `GET /settings` after reload.

### `src/api/client.js`
- `settingsApi.uploadStamp(form)` → `POST /settings/stamp` (multipart).

---

# Session — 2026-06-20 · Booking form: phone & email validation + error feedback

## Summary
The new-booking form had no validation for the guest phone or email, and validation errors only
appeared inline — easy to miss since the "Create Booking" button sits at the bottom of a long form.
Added input restriction + validation for phone and email, and on a failed submit the form now toasts
the first error and scrolls/focuses the offending field. Booking submit failures now surface as a
toast too (previously an inline text banner), and the global toast styling/position was corrected.

## File changes

### `src/components/modules/bookings/BookingForm.jsx`
- Phone: new `setPhone` handler strips non-digits and caps at 10 characters; field is now `type="tel"`
  with `inputMode="numeric"` and `maxLength={10}`. Validates to exactly 10 digits when provided
  (stays optional).
- Email: `validate()` now rejects malformed addresses (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`) when provided
  (stays optional); wired `error={errors.guestEmail}` onto the field.
- `validate()` now returns the error object instead of a boolean.
- `handleSubmit`: on validation failure, toasts the first error (in field order
  `guestName → guestPhone → guestEmail → roomId → toDate/months`) and scrolls + focuses that field.
- Added `name` attributes to the validated fields so the scroll/focus lookup resolves them.
- Booking-submit failures now `toast(...)` instead of `setApiError(...)` (no more inline text banner
  for submit errors; the rooms-load banner on mount is unchanged).
- Fixed toast type: all booking toasts use `'danger'` (the supported type) instead of `'error'`,
  which had no icon and fell back to the default gold border.

### `src/components/ui/Toast.jsx`
- Moved the toast container from bottom-right (`bottom-5`) to top-right (`top-5`). Global change —
  affects all toasts app-wide.

### `src/index.css`
- Renamed the `slideUp` toast keyframe to `slideDown` (enters from `-8px`) so toasts animate in from
  above, matching the new top position.

---

# Session — 2026-06-19 · Documents upload respects the 4-doc limit

## Summary
The Documents tab's Upload modal always showed 4 *empty* slots regardless of what was already
uploaded, so you could keep adding files and push the count past the limit (e.g. "6 / 4"). The
modal is now aware of existing documents: filled slots are locked, and you can't queue more files
than remain before the cap. Pairs with the new server-side cap (see server CHANGES.md).

## File changes

### `src/components/modules/documents/Documents.jsx`
- Added `MAX_DOCUMENTS = 4` and a `normDocType` helper (normalises to alphanumerics) so existing
  docs match back to their slot despite inconsistent `docType` naming across sources (`idFront`
  vs booking labels like `ID Front` vs seed values like `Photo`).
- `UploadModal`: slots whose `docType` already exists render as "✓ Already uploaded", disabled and
  non-clickable.
- `UploadModal`: empty slots lock with "Limit reached" once queued files reach the remaining count
  (`4 − uploaded`); the input is `disabled` and click/drop are guarded.
- `UploadModal`: footer notice shows slots left, or "All 4 document slots are filled" when none
  remain.

---

# Session — 2026-06-19 · Unify the check-out modal across Bookings & Guests

## Summary
The Bookings and Guests tabs used two different check-out modals. Unified them onto one shared
component (the Guests two-step "Bill Summary → Confirm & Pay" design), built as a superset so the
booking-only billing controls (extra charges, partial "collect now", payment reference) are opt-in
via flags and nothing is lost. Both tabs now show identical fields. Also made the payment-method
list uniform (single lowercase list) and switched the Guests bill from a hardcoded frontend mock to
the real bill fetched from the backend.

## File changes

### `src/components/modules/checkout/CheckOutModal.jsx`
- Rewrote as the shared, entity-agnostic modal. Callers pass a normalised bill
  (`guestName`, `folio`, `room`, `stayPeriod`, `lineItems`, `advance`, `balanceDue`) and get raw
  inputs back via `onConfirm({ extra, finalPayment, paymentMethod, paymentReference, notes, proofFile })`.
- Booking extras gated behind `allowExtraCharges` / `allowPartialPayment` (extra-charges field,
  editable "collect now", reference field, running "balance after check-out"). Guests render the
  fixed full-balance box when flags are off.
- `DEFAULT_METHODS` is now the lowercase list (`cash`/`card`/`upi`/`bank_transfer`/`cheque`/`other`)
  shared by both flows. Reference field shows for non-cash when collecting.
- No reset effect: both call sites render the modal conditionally (unmounts on close), so lazy
  state initialisers default "collect now" to the full balance on every open.

### `src/components/modules/bookings/Bookings.jsx`
- Uses the shared modal with normalised props + both flags on; dropped the local `PAYMENT_METHODS`
  (uses shared default). `handleCheckOut` reads the new result shape and folds `extra` onto the
  booking's existing charges.

### `src/components/modules/guests/Guests.jsx`
- Deleted the inline `CheckoutModal` (~155 lines) and the hardcoded `calcCheckout` mock.
- `openCheckout` now fetches the real bill via `guestsApi.checkoutPreview(id)` and renders the modal
  only once the bill loads; both flags enabled. `handleCheckoutConfirm` sends `extraCharges`,
  `finalPayment`, `paymentMethod`, `paymentReference`.

### `src/api/client.js`
- Added `guestsApi.checkoutPreview(id)` → `GET /guests/:id/checkout-preview`.

---

# Session — 2026-06-19 · Housekeeping staff list fetched dynamically from users

## Summary
The Housekeeping module's staff dropdowns (Daily List filter, per-room "Assigned To" select, and
the room Assignment modal) were populated from a hardcoded `HK_STAFF` array of placeholder names.
Replaced it with a dynamic list fetched from the users API. On mount, the module now calls
`usersApi.getAll()`, keeps only **active** users, maps to their names, sorts alphabetically, and
threads the result down as a `staff` prop. The loader fails soft (leaves the list empty on error),
matching the existing `loadLinen` behavior. No backend change.

Note: this lists all active users, since the user model has no dedicated "housekeeping staff" flag.

## File changes

### `src/components/modules/housekeeping/Housekeeping.jsx`
- Removed the hardcoded `HK_STAFF` constant.
- Imported `usersApi`; added `staff` state and a `loadStaff()` loader (active users only, sorted),
  called from the boot `useEffect` alongside `loadBoard`/`loadLinen`.
- Threaded `staff` into `DailyListTab` (Staff filter + Assigned To select) and `AssignRoomModal`.

---

# Session — 2026-06-19 · Fix Edit Template modal in Settings → Notifications

## Summary
The "Edit Template" button in Notification Management (Settings page) did nothing when clicked.
The button set `editingId`, but the editor `Modal` was rendered without an `isOpen` prop. Since
`Modal` returns `null` when `isOpen` is falsy, the modal silently rendered nothing. Added the
`isOpen` prop. It's safe to hardcode because the block is already guarded by
`{editingId && editingTpl && (...)}`, so the Modal only mounts when there's a template to edit.
No backend change.

## File changes

### `src/components/modules/settings/Settings.jsx`
- Added `isOpen` to the `<Modal>` in `NotificationsTab`'s Edit Template block.

---

# Session — 2026-06-19 · Sidebar shows saved hotel name after fresh login

## Summary
On a fresh login in a new browser the sidebar showed the hardcoded default name ("Quantum Vorvex")
instead of the name saved in Settings, only correcting itself once the Settings page was opened.
The sidebar reads `s.hotel.hotelName` from Redux, whose initial state is the hardcoded default; it
was only updated via `setHotelName` on Settings save / SetupWizard / Settings page mount. Nothing
hydrated it at app boot. Added a boot-time fetch of `GET /settings` that pushes the saved
`name`/`ownerName` into the store as soon as a token is present, so the correct name shows
immediately on any fresh login. No backend change.

## File changes

### `src/App.jsx`
- Imported `useHotelActions` and `settingsApi`; destructured `setHotelName`/`setOwnerName`.
- Added a `useEffect` keyed on `token` that calls `settingsApi.get()` and dispatches
  `setHotelName`/`setOwnerName` from `data.hotel` (cancel-guarded, falls back to defaults on error).

---

# Session — 2026-06-19 · Delete option for cancellations

## Summary
Added a delete action to the Cancellations page. A cancellation is just a booking with status
`Cancelled`, so this reuses the existing booking soft-delete (`bookingsApi.remove` →
`DELETE /bookings/:id`); a deleted booking already drops out of this list. No backend change.

## File changes

### `src/components/modules/cancellations/Cancellations.jsx`
- Added a trailing actions column with a red `LuTrash2` button (title "Delete cancellation"),
  `deleteTarget`/`deleting` state, a `handleDelete` calling `bookingsApi.remove` (removes the row +
  toast), and a `<ConfirmModal>`.
- Imported `ConfirmModal` and `LuTrash2`.

### `tests/soft-delete.spec.js`
- Added a cancellations E2E delete test (creates → cancels → deletes a booking). Suite now 9/9 green.

---

# Session — 2026-06-19 · Replace 🗑 emoji with a clean Lucide trash icon

## Summary
The delete buttons used the 🗑 emoji, which rendered inconsistently/ugly across platforms. Swapped
every one for the `LuTrash2` icon from `react-icons/lu` (the icon set already used in the sidebar/
topbar), sized 14–15px and vertically centred.

## File changes
- `src/components/modules/rooms/Rooms.jsx` — "Delete Room" button icon.
- `src/components/modules/bookings/BookingsTable.jsx` — row delete.
- `src/components/modules/guests/Guests.jsx` — row delete.
- `src/components/modules/maintenance/TicketCard.jsx` — card delete.
- `src/components/modules/billing/Billing.jsx` — invoice row delete.
- `src/components/modules/documents/Documents.jsx` — row delete + per-document delete (modal).
- Each imports `{ LuTrash2 } from 'react-icons/lu'`.

### `tests/soft-delete.spec.js`
- Updated the room-delete locator from the emoji name to `{ name: 'Delete Room' }` (other tests
  locate by `title`, unaffected). Suite still 8/8 green.

---

# Session — 2026-06-19 · Delete option for invoices (Billing) & documents

## Summary
Added delete to the Billing and Documents pages — the last two list pages without it. Both use the
shared `ConfirmModal`. Invoice delete is a server-side soft delete that also removes the invoice
from all money totals; document delete is a permanent hard delete of the file (see `server/CHANGES.md`).

## File changes

### `src/api/client.js`
- Added `billingApi.delete(id) → DELETE /billing/:id` and `documentsApi.delete(id) → DELETE /documents/:id`.

### `src/components/modules/billing/Billing.jsx`
- Added a red `🗑` (title "Delete invoice") to each invoice row's Actions, `deleteModal`/`deleting`
  state, a `handleDelete` calling `billingApi.delete` (toast + reload list & stats), and a
  `<ConfirmModal>` warning it's removed from billing/ledger/cash register/revenue reports.

### `src/components/modules/documents/Documents.jsx`
- Added a **row-level** `🗑` (title "Delete all documents for this guest") in the Documents table
  Actions, shown when the guest has ≥1 file — deletes them all via `Promise.all(documentsApi.delete)`.
  This is the visible delete users expect on the page (matches every other module's row delete).
- Also added a **per-document** `🗑` (title "Delete document") inside the **View Docs** modal for
  granular single-file deletion (new `onDelete` prop on `ViewDocsModal`).
- Both confirmed via `<ConfirmModal>`; both reload the list.

### `tests/soft-delete.spec.js`
- Added billing-invoice + two document E2E delete tests (modal per-doc and row-level). Suite now
  8 tests, all green.

---

# Session — 2026-06-18 · Delete option for guests & maintenance tickets

## Summary
Extended the delete action to the two remaining list pages that lacked it: Guests and Maintenance.
Both use the shared `ConfirmModal`. Guest delete is a server-side soft delete (see
`server/CHANGES.md`); maintenance ticket delete is a hard delete (the endpoint already existed).

## File changes

### `src/api/client.js`
- Added `guestsApi.delete(id) → DELETE /guests/:id`.

### `src/components/modules/guests/Guests.jsx`
- Added a red `🗑` action (title "Delete guest") to each guest row, `deleteGuest`/`deleting` state,
  a `handleDeleteConfirm` calling `guestsApi.delete` (toast + reload), and a `<ConfirmModal>`
  noting billing history is kept and the room is freed.

### `src/components/modules/maintenance/TicketCard.jsx`
- Added an optional `onDelete` prop and a red `🗑` button (right-aligned in the status footer).

### `src/components/modules/maintenance/Maintenance.jsx`
- Added `deleteTarget`/`deleting` state, a `handleDelete` calling the existing `maintenanceApi.remove`
  (removes the card on success), passed `onDelete` to `TicketCard`, and rendered a `<ConfirmModal>`.

### `tests/soft-delete.spec.js`
- Extended the Playwright suite with guest-delete and ticket-delete E2E tests (now 5 tests, all
  green). Guest test also asserts the freed room and that the API no longer lists the guest.

---

# Session — 2026-06-18 · Delete option for bookings

## Summary
Bookings could be cancelled but never removed from the list. Added a delete action to each
booking row, guarded by a confirmation dialog. Server-side this is a **soft delete** (the row is
stamped `deletedAt` and hidden everywhere, but its payment/invoice history is preserved) — see
`server/CHANGES.md`. The `bookingsApi.remove` helper and `DELETE /bookings/:id` route already
existed; the UI and the soft-delete behaviour were added.

## File changes

### `src/components/modules/bookings/BookingsTable.jsx`
- Added an `onDelete` prop and a red `🗑` (danger) button to the actions column, shown for every
  row regardless of status. Disabled while the row is busy.

### `src/components/modules/bookings/Bookings.jsx`
- Added `deleteTarget` state and a `handleDelete` handler that calls `bookingsApi.remove(id)` via
  the shared `runAction` helper (toast + reload of list and stats).
- Passed `onDelete={setDeleteTarget}` to `BookingsTable`.
- Rendered a `<ConfirmModal>` ("Permanently delete booking X for <guest>? …")
  with a busy state, reusing the same confirm pattern as the rooms delete.
- Imported `ConfirmModal` from `../../ui/ConfirmModal`.

---

# Session — 2026-06-18 · Delete option for rooms

## Summary
There was no way to delete a room from the UI. Added a delete action to the room detail modal,
guarded by a confirmation dialog. The backend route (`DELETE /rooms/:id`) and `roomsApi.delete`
helper already existed — only the UI was missing.

## File changes

### `src/components/modules/rooms/Rooms.jsx`
- **`RoomDetail`**: added a red `🗑 Delete Room` button to the Quick Actions row, wired to a new
  `onDelete` prop.
- Added `deleteRoom` / `deleting` state and a `handleDeleteRoom` handler that calls
  `roomsApi.delete(id)`, shows a success/error toast, and reloads the room list.
- Rendered a `<ConfirmModal>` ("Delete Room X? This cannot be undone.") with a busy state,
  matching the confirm pattern used in `UsersRoles` instead of native `window.confirm`.
- Imported `ConfirmModal` from `../../ui/ConfirmModal`.

---

# Session — 2026-06-16 · Download button for room maintenance QR

## Summary
Added a "Download QR" button next to "Print sticker" in the room's Maintenance QR modal, so
the user can save the QR as an image (with the room number) instead of only printing it.

## File changes

### `src/components/modules/rooms/Rooms.jsx`
- **`RoomQrCode`**: added a `handleDownload` that serializes the room QR `<svg>`, draws it onto
  a canvas with a `Room {number}` caption above it, and triggers a PNG download named
  `room-{number}-qr.png`. The image includes both the QR code and the room number.
- Rendered a `⬇ Download QR` (outline) button alongside the existing `🖨 Print sticker` button,
  wrapping the pair in a `flex items-center justify-center gap-2` row.

---

# Session — 2026-06-16 · QR report page: custom category dropdown (fixes overlapping options)

## Summary
The "What needs attention?" category picker on the public report page (`/report`) used a native
`<select>`. Its dropdown popup is OS/browser-rendered and showed overlapping option text on the
user's machine. Replaced it with a custom, fully-styled dropdown for consistent rendering.

## File changes

### `src/components/modules/maintenance/GuestMaintenanceForm.jsx`
- First tried a CSS fix: the `@tailwindcss/forms` chevron sits at the right edge but the shared
  `px-4` had overridden the plugin's `padding-right`, so the selected value overlapped the arrow.
  That helped the closed state but the open native popup still rendered inconsistently.
- Replaced the native `<select>` with a new `CategorySelect` component: a styled trigger button
  (value + chevron) and a click-to-open `role="listbox"` panel rendered as real DOM — opaque
  `bg-surface`, rounded, `shadow-lift`, `z-20`, each option its own padded row with hover +
  gold-highlighted selection. Closes on outside-click / Escape; same `value`/`onChange` contract,
  so submit logic is unchanged.
- Verified the open state with a Playwright screenshot (possible now that options are DOM): all
  six categories render on separate lines with no overlap.

---

# Session — 2026-06-16 · Mobile polish for the QR maintenance report page

## Summary
The public "Report an Issue" page (`/report?t=<qrToken>`, reached by scanning a room's
maintenance QR) looked cramped on mobile. Reworked its styling to be mobile-first. Logic
unchanged — markup/CSS only.

## File changes

### `src/components/modules/maintenance/GuestMaintenanceForm.jsx`
- **iOS zoom fix**: this page's inputs used the shared `.form-input/.form-select` classes at
  13px; iOS Safari auto-zooms the page when focusing any sub-16px field. Replaced them with
  page-local Tailwind controls at `text-base` (16px), `px-4 py-3`, `rounded-xl`, and a larger
  focus ring. Left the global `.form-*` classes untouched (used across the authed app).
- Bigger tap targets and spacing (`gap-5`), `min-h-[100dvh]` instead of `min-h-screen` (no
  mobile URL-bar gap), and `env(safe-area-inset-bottom)` padding for notched phones.
- The theme defines both `--main-bg` and `--surface` as pure white, so the card was
  invisible against the page. Tinted the page with `bg-surface2` (faint cream) and kept the
  card white so it lifts off the background; vertically centered the form (`justify-center`)
  so it doesn't strand empty space on tall screens.
- **Width/scroll fix (the page rendered as a narrow left column):** `#root` is a full-height
  flex **row** with `overflow:hidden` (index.css). A single flex child shrinks to its content
  width, so the page sat in a `max-w-md`-wide strip with empty space beside it, and a tall
  form couldn't scroll. Wrapped the page in a `flex-1 min-w-0 overflow-y-auto` container (the
  same pattern `LoginPage.css` uses) with an inner `min-h-full` centering layer — now it fills
  the viewport width at every size and scrolls when the form exceeds the screen.
- Polished header (gold icon badge + room shown as a pill), `shadow-soft` card, larger
  success/error states, ticket number rendered as a mono chip.
- Submit button: `text-black` on gold (better contrast than the old `text-white`), full-width
  `py-3.5`, with an `active:scale` press cue.

---

# Session — 2026-06-16 · Payment-proof attachment on guest check-out

## Summary
The guest check-out modal collected payment method + remarks but had no way to attach a
payment screenshot/receipt, unlike the bookings check-out. Added the attachment field and
wired the upload, mirroring the bookings flow. (Server side: see `../server/CHANGES.md`.)

## File changes

### `src/components/modules/guests/Guests.jsx`
- Added a "Payment screenshot / proof (optional)" file field to step 2 of the inline
  `CheckoutModal` — same image/PDF picker, 10MB cap, and remove button as the bookings
  `CheckOutModal`. New `proof`/`proofError` state + `pickProof` validator; the file is passed
  through `onConfirm`.
- `handleCheckoutConfirm` now uploads the proof (multipart, `docType: payment_proof`) **before**
  calling `guestsApi.checkout`, so a failed upload aborts the check-out — same ordering as
  bookings. Also forwards `notes`/`paymentMethod` in the checkout body.
- Added `key={checkoutGuest?.id}` on `<CheckoutModal>` so each guest gets a fresh form; prevents
  a prior guest's step/receipt from leaking into the next check-out (the modal component stays
  mounted otherwise).

### `src/api/client.js`
- Added `guestsApi.uploadDocuments(id, form)` → `POST /guests/:id/documents` (multipart).

---

# Session — 2026-06-16 · New-booking check-in date defaults to today

## Summary
The new-booking form defaulted the check-in date to 2026-06-02 (a hardcoded demo "today")
instead of the actual current date.

## File changes

### `src/utils/booking.js`
- Replaced the hardcoded `TODAY = '2026-06-02'` constant with a computed local current date
  in `YYYY-MM-DD` format (using `getMonth`/`getDate` rather than `toISOString()` to avoid a
  UTC/IST off-by-one).
- This flows into the new-booking form's default `fromDate` (`EMPTY.fromDate = TODAY` in
  `BookingForm.jsx`) and the `isUpcoming` date comparison, which both keep working since the
  string format is unchanged.

---

# Session — 2026-06-16 · E2E test for booking-time documents in the Documents tab

## Summary
Added Playwright coverage for the server fix that surfaces booking-time ID documents in the Documents
(KYC) tab before check-in (see `../server/CHANGES.md`).

## File changes

### `tests/documents-booking.spec.js` (new)
- Helper creates a Confirmed booking (no check-in → no linked `Guest`) and uploads an ID doc to it,
  trying rooms until one is free (some seed rooms have open-ended guests that conflict with any date).
- **API test**: asserts `GET /documents` returns a guest-like row keyed `booking:<id>` with
  `docId === bookingNo`, the booking's `name`, and a document carrying `source: 'booking'`.
- **UI test**: logs in, opens Documents, filters by booking number, and asserts the row + guest name
  render.
- Uses `E2E_API_URL` (default `http://localhost:5001/api/v1`) for direct setup calls, since the dev
  backend + Vite proxy run on **5001** here (the shared `tests/helpers.js` still hardcodes 5000).

## Verification performed
- Both tests pass against the fix.
- False-positive guard: temporarily dropped `orphanGuests` from the server response — both tests
  failed; restoring the fix made them pass again.

---

# Session — 2026-06-16 · Guests & Billing: server-side search, filter & pagination

## Summary
Rolled the Bookings pattern (previous entry) out to the Guests and Billing pages: debounced server-side
search, server-side status/stay filtering, pagination, and full-dataset stat cards fed by new
`/guests/stats` and `/billing/stats` endpoints (see `../server/CHANGES.md`).

## File changes

### `src/api/client.js`
- Added `guestsApi.getStats(params)` and `billingApi.getStats(params)`.

### `src/components/modules/guests/Guests.jsx`
- Search debounced (300ms) → `search` param; stay/status selects → `stayType`/`status` params; results
  paginated (`PAGE_SIZE = 20`). Removed the client-side `filtered` memo and the `activeCount`/`dueCount`/
  `checkedOutCount` derivations — the page holds only one page of rows.
- Summary cards now come from `getStats()` (whole-dataset), refreshed on mount and after
  checkout/renew/edit. Changing search or a filter resets to page 1; added a Prev/Next pager.
- "Export CSV" now fetches all rows matching the current filters (not just the visible page).
- Removed the now-unused `useMemo` import.

### `src/components/modules/billing/Billing.jsx`
- Same treatment for the Invoices tab: debounced `search`, status-pill `status` filter, pagination, and
  stat cards from `getStats()` (collected/pending/overdue/GST). Record count now shows the server total;
  added a pager. Collect/Generate reload list + stats; "Export CSV" exports all matching rows.
- Removed the unused `useMemo` import; converted `RemindModal`'s prefill (previously `setState` inside
  `useMemo`) to a derived initial state with a per-invoice `key` on the modal — fixes the cascading-render
  lint error and the original misuse of `useMemo`.

---

# Session — 2026-06-16 · Bookings: server-side search, filter & pagination

## Summary
Migrated the Bookings page from client-side in-memory filtering (load all rows, filter with useMemo) to
server-driven search / status-filter / pagination, backed by a new `/bookings/stats` aggregate endpoint
(see `../server/CHANGES.md`). This is the reference pattern for the other list pages.

## File changes

### `src/api/client.js`
- Added `bookingsApi.getStats(params)` → `GET /bookings/stats`.

### `src/components/modules/bookings/Bookings.jsx`
- Search box is now debounced (300ms) and sent to the API as `q`; the active tab is sent as `status`
  (including the derived `Upcoming`), and results are paginated (`PAGE_SIZE = 20`). Removed the
  client-side `filtered`/`stats`/`counts` useMemos — the page now holds only one page of rows.
- Stat cards and tab counts are fed by `getStats()` (full-dataset), refreshed on mount and after any
  mutation, so they stay whole-dataset rather than reflecting the current search/page.
- Changing search or tab resets to page 1; added a Prev/Next pager with "showing X–Y of N".
- Booking actions (check-in/out, confirm, cancel, create) now reload the list + stats instead of patching
  a single row in place (a status change can move a row out of the current tab/page).
- Removed now-unused `useMemo` and `isUpcoming` imports.

---

# Session — 2026-06-15 · Hide Remind button on paid invoices

## File changes

### `src/components/modules/billing/Billing.jsx`
- The "Remind" button in the invoices table was rendered unconditionally, so it still showed for
  fully-paid invoices (checkout complete). Gated it on `inv.status !== 'Paid'`, matching the existing
  "Collect" button's status guard. Remind now only appears for Pending/Overdue invoices.

---

# Session — 2026-06-15 · Free-form password on edit-user

## File changes

### `src/validation/userSchema.js`
- Removed the password strength rules (min length / uppercase / number) — the password field is now a
  plain optional string (max 128). Admin password resets on the edit-user form are free-form.

### `src/components/ui/ChangePasswordModal.jsx`
- Dropped the strength rules from the self-service Change Password form too: `newPassword` is now
  required + max 128 only (placeholder updated). The confirm-match check stays. Backend
  `changePassword` relaxed to match. Password strength rules are now gone everywhere a password is set.

### `tests/rbac-frontend.spec.js`
- Updated the change-password test to the new placeholder ("Enter a new password").

---

# Session — 2026-06-14 · Protected super-admin (UI lock)

## Summary
Client side of the protected super-admin (backend in `../server/CHANGES.md`): the super-admin row in
Users & Roles is visually marked and locked down.

## File changes

### `src/components/modules/users/UsersRoles.jsx`
- Super-admin row shows a gold **★ Super Admin** tag and hides the Deactivate/Delete actions.
- In the user edit modal, the Role and Status selects are disabled for the super-admin (with a note
  that role/status are locked; name/password remain editable). Uses the `isSuperAdmin` flag now
  returned by `GET /users`.

### `tests/rbac-enforcement.spec.js`
- Added a test: the super-admin is seeded + `isSuperAdmin`, and role-change / deactivate / delete all
  return 403, while the seeded credentials log in.

---

# Session — 2026-06-14 · Reusable ConfirmModal (replace native delete alerts)

## Summary
Replaced the native `window.confirm()` dialogs on the Users & Roles delete actions with a styled
in-app confirmation modal.

## File changes

### `src/components/ui/ConfirmModal.jsx` (new)
- Reusable confirm dialog built on `Modal`: `title` / `message` / `confirmLabel` / `cancelLabel`,
  a `danger` variant (red confirm button), and a `busy` state (disables buttons, shows "Working…").

### `src/components/modules/users/UsersRoles.jsx`
- User and role deletes now open `ConfirmModal` instead of `window.confirm`. A single `runDelete()`
  handles either kind via a `{ kind, item }` state, with a `deleting` busy flag and error toasts.

### `tests/rbac-frontend.spec.js`
- Added a test: deleting a role opens the in-app confirm modal and completes — with a
  `page.on('dialog')` guard asserting no native browser dialog fires.

---

# Session — 2026-06-14 · RBAC Phase 4 — Drop legacy role + create-user autofill fix

## Summary
Removed all reliance on the legacy `currentUser.role` string (backend dropped the column) — display
and owner checks now use `roleName` + `isOwner`. Also fixed the "Add User" form: the password field
was being autofilled by the browser with saved credentials.

## File changes

### `src/components/modules/users/UsersRoles.jsx` (autofill fix)
- The **create** form no longer renders a password field (the server applies the `Welcome@123`
  default); it shows a note instead. A password field appears **only when editing** (optional reset)
  with `autoComplete="new-password"`. Form + name/email/phone set `autoComplete="off"`.
- `canManageRoles` is now `!!currentUser?.isOwner` (was `role === 'owner'`).

### `src/utils/permissions.js`
- Removed `ROLE_LABELS` / `ROLE_COLORS`; `isOwnerUser` checks `user.isOwner` only.

### `src/components/layout/Sidebar.jsx`
- Role badge uses `currentUser.roleName` + an `isOwner`-based color (dropped the role→label/color maps).

### `src/components/modules/settings/Settings.jsx`
- Uses `currentUser.isOwner` for the owner-only "Run Setup" control (was `role === 'owner'`).

### `src/api/mockData.js`
- `MOCK_USER` now carries `roleName` + `isOwner` + `permissions` (was `role: 'owner'`).

### `tests/users-roles.spec.js`
- Create-user test now asserts there is **no** `input[name="password"]` on create and that the
  default-password note is shown.

---

# Session — 2026-06-14 · RBAC Phase 3 — Dynamic frontend permissions

## Summary
The frontend now reads the live permission map (`currentUser.permissions` + `isOwner`, delivered by
the backend on login / `/auth/me`) instead of a hardcoded role→panels table. Sidebar visibility,
panel access, and action gating are permission-driven, so custom roles render correctly. Added
self-service password change (available to every user, including staff) and a 403 resync.

## File changes

### `src/utils/permissions.js` (rewritten)
- Replaced the static `ROLE_PANELS`/`ROLE_SETTINGS_TABS` tables with a `PANEL_MODULE` map +
  `hasModule(user, module, level)`, `canAccess(user, panel)`, `getAllowedPanels(user)`, and
  `canAccessSettingsTab(user, tab)`. Exported `ALL_PANELS`. `today`/`cancellations` derive from the
  `bookings` module; Settings sub-tabs derive from settings access. Kept `ROLE_LABELS`/`ROLE_COLORS`.

### `src/store/slices/uiSlice.js`
- `panelFromUrl` now validates against `ALL_PANELS` (was `ROLE_PANELS.owner`).

### `src/components/layout/Sidebar.jsx`
- `getAllowedPanels(currentUser)` (was role string). Added a **Change Password** control in the user
  footer (always available) that opens `ChangePasswordModal`.

### `src/App.jsx`
- `canAccess(currentUser, activePanel)` for the access gate. Added a boot effect that refreshes
  `/auth/me` (resyncs permissions) and listens for `auth:forbidden` to resync after a live access change.

### `src/api/client.js`
- Response interceptor now also handles `403 ERR_FORBIDDEN`: dispatches an `auth:forbidden` window
  event so the app resyncs the permission map / sidebar.

### `src/components/modules/settings/Settings.jsx`
- Settings tabs filtered via `canAccessSettingsTab(currentUser, …)`.

### `src/components/modules/users/UsersRoles.jsx`
- User CRUD gated by `useCan('users', 'MANAGE')`; role CRUD remains owner-only.

### `src/hooks/useCan.js` (new)
- `useCan(module, level='MANAGE')` — reads the live permission map for action gating.

### `src/components/ui/ChangePasswordModal.jsx` (new)
- Formik + Yup modal hitting `authApi.changePassword`; on success swaps in the reissued token
  without disrupting the session. Launched from the sidebar (not gated by any module).

### `tests/rbac-frontend.spec.js` (new)
- Playwright (4 tests): staff sidebar shows front-desk/ops only; owner sees finance + admin;
  any user can change their password via the sidebar; a custom `billing:VIEW` role sees Billing but
  not Reports/Settings/Guests.

---

# Session — 2026-06-14 · RBAC Phase 2 — enforcement (client touches)

## Summary
Phase 2 was backend-heavy (see `../server/CHANGES.md`). On the client: added the change-password
API helper and end-to-end enforcement tests. The sidebar still gates by the legacy role string —
making it read the live permission map (+ a 403 interceptor) is Phase 3.

## File changes

### `src/api/client.js`
- Added `authApi.changePassword(data)` → `POST /auth/change-password`.

### `tests/rbac-enforcement.spec.js` (new)
- Playwright (4 tests, hits the API at `:5001`): access matrix for staff/manager/owner; role
  reassignment + deactivation take effect on the same token; change-password (new works / old fails);
  non-owner cannot create/delete roles.

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
