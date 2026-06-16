# WhatsApp Reminder Integration — Implementation Plan

**Goal:** When staff click **Remind** on an unpaid invoice and choose the *WhatsApp* channel,
open WhatsApp Web with the guest's number selected and the reminder message pre-typed,
ready for the staff to review and hit send.

**Date:** 2026-06-16
**Owner:** Frontend (Billing module)

---

## 1. Approach decision

| Option | What it does | Cost / setup | Verdict |
|--------|--------------|--------------|---------|
| **A. Click-to-chat (`wa.me` link)** | Opens WhatsApp Web with number + message pre-filled; staff click send manually | Free, no API, works with any logged-in WhatsApp (personal or business) | ✅ **Chosen** — matches the requested UX exactly |
| B. WhatsApp Business Cloud API (Meta) | Fully automated server-side send, no human click | Paid per conversation, Meta Business onboarding, pre-approved templates, backend work | ❌ Out of scope for now (revisit if bulk/auto-send is needed) |

**Decision: Option A.** The "business account" requirement is satisfied simply by being the
account logged into WhatsApp Web in the browser.

---

## 2. How `wa.me` works

```
https://wa.me/<number>?text=<url-encoded-message>
```

- `<number>` — **digits only, with country code, no `+`, no spaces** (e.g. `919876543201`).
- `text` — URL-encoded message body.
- Opening the URL launches WhatsApp Web (desktop) / the app (mobile) with the chat open
  and the message typed, ready to send.

---

## 3. Problem in current data

Guest phone numbers are inconsistent in the data:
- `'9876543201'` — 10-digit local, **no country code**
- `'+91 98765 43210'` — has `+` and spaces

So a sanitizer is required: strip non-digits, and prepend the default country code (`91`)
when the number is a bare 10-digit local number.

Also, **`normalizeInvoice` does not currently include a `phone` field**
([client/src/components/modules/billing/Billing.jsx:10-27](src/components/modules/billing/Billing.jsx#L10-L27)),
so the guest phone must be threaded through to the `RemindModal`.

---

## 4. Implementation steps

### Step 1 — Add a `whatsappUrl` helper
**File:** `client/src/utils/booking.js` (or a new `client/src/utils/whatsapp.js`)

```js
// Build a WhatsApp click-to-chat URL.
// phone: raw guest phone (any format). defaultCc: country code assumed if missing.
export function whatsappUrl(phone, message, defaultCc = '91') {
  let digits = String(phone || '').replace(/\D/g, '') // strip +, spaces, dashes
  if (!digits) return null
  if (digits.length === 10) digits = defaultCc + digits // bare local -> add CC
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}
```

### Step 2 — Thread guest phone into the invoice object
**File:** [client/src/components/modules/billing/Billing.jsx:10-27](src/components/modules/billing/Billing.jsx#L10-L27)

Add to `normalizeInvoice` return:
```js
phone: inv.guest?.phone || '',
```

> ⚠️ **Verify backend:** confirm the invoice list API (`GET /billing/invoices`) returns
> `guest.phone`. If not, either include it in the server query/serializer, or look the
> phone up from the guests list by `guestId` on the client.

### Step 3 — Open WhatsApp Web on the WhatsApp channel
**File:** `handleRemind` at [client/src/components/modules/billing/Billing.jsx:864](src/components/modules/billing/Billing.jsx#L864)

```js
const handleRemind = async (channel, message) => {
  if (!remindModal) return
  try {
    if (channel === 'WhatsApp') {
      const url = whatsappUrl(remindModal.phone, message)
      if (!url) return addToast('No valid phone number for this guest', 'error')
      window.open(url, '_blank', 'noopener,noreferrer') // opens WhatsApp Web
      if (remindModal.guestId) { // optional: log so it appears in reminder history
        await remindersApi.send({ guestId: remindModal.guestId, channel, message })
      }
      addToast('WhatsApp opened — review and hit send', 'success')
      setRemindModal(null)
      return
    }
    // SMS / Email path unchanged
    if (remindModal.guestId) {
      await remindersApi.send({ guestId: remindModal.guestId, channel, message })
    }
    addToast(`Reminder sent via ${channel}`, 'success')
    setRemindModal(null)
  } catch (err) {
    addToast(err.response?.data?.error || 'Could not send reminder', 'error')
  }
}
```

> Note: `window.open` runs inside the click handler **before** any `await` so pop-up
> blockers don't kill it. (The `remindersApi.send` log call happens after.)

### Step 4 — (Optional) UX polish in `RemindModal`
**File:** [client/src/components/modules/billing/Billing.jsx:237](src/components/modules/billing/Billing.jsx#L237)

- Change the button label to "Open in WhatsApp" when `channel === 'WhatsApp'`.
- Show the resolved recipient number; disable the button if no valid phone.

---

## 5. Edge cases & prerequisites

- **WhatsApp Web login:** browser must be logged into WhatsApp Web; first use shows the
  QR login (one-time, expected).
- **Country code:** `defaultCc = '91'` fits current (Indian) data; make configurable if
  multiple countries are served.
- **Missing/invalid phone:** guarded — shows an error toast instead of opening a broken tab.
- **Pop-up blockers:** mitigated by opening in the direct click path.

---

## 6. Files to change

| File | Change |
|------|--------|
| `client/src/utils/booking.js` | Add `whatsappUrl()` helper |
| `client/src/components/modules/billing/Billing.jsx` | Add `phone` to `normalizeInvoice`; update `handleRemind`; optional `RemindModal` polish |
| Backend invoice serializer (verify) | Ensure `guest.phone` is returned |

---

## 7. Testing checklist

- [ ] Click **Remind** on an unpaid invoice → choose WhatsApp → tab opens with correct number + message.
- [ ] Guest with `+91 98765 43210` format → opens correctly (sanitized).
- [ ] Guest with bare `9876543201` → country code prepended.
- [ ] Guest with no phone → error toast, no tab opened.
- [ ] SMS / Email channels still behave as before.
- [ ] Reminder appears in history (if Step 3's optional log call is kept).

---

## 8. Future enhancement (Option B)

If automated / bulk sending becomes a requirement, migrate to the WhatsApp Business
Cloud API: Meta Business onboarding, verified sender number, approved message templates,
and a server-side send endpoint. Track separately.
