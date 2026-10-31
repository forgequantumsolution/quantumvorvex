/**
 * Small derived-value helpers shared by the Bookings / Check-In / Check-Out /
 * Cancellations pages. Pure functions over a booking record.
 */
import { formatDate } from './format'

// Local "today" as a YYYY-MM-DD string (avoids the UTC off-by-one of toISOString).
export const TODAY = (() => {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
})()

// Outstanding balance = total amount − advance paid.
export function balance(b) {
  return Math.max(0, (Number(b.amount) || 0) - (Number(b.advance) || 0))
}

// Human-readable stay duration ("3 nights" or "2 months").
export function stayLabel(b) {
  // PG tenancy: open-ended, rent billed monthly.
  if (b.stayType === 'monthly' && !b.months) return 'Monthly rent · until move-out'
  if (b.stayType === 'monthly') return `${b.months} month${b.months !== 1 ? 's' : ''}`
  return `${b.nights} night${b.nights !== 1 ? 's' : ''}`
}

// "08 Jun → 11 Jun" or "from 08 Jun (monthly)".
export function dateRangeLabel(b) {
  if (b.stayType === 'monthly' && !b.months) return `From ${formatDate(b.fromDate)}`
  if (b.stayType === 'monthly') return `${formatDate(b.fromDate)} · ${stayLabel(b)}`
  return `${formatDate(b.fromDate)} → ${formatDate(b.toDate)}`
}

// Active = not cancelled and not checked out.
export function isActive(b) {
  return b.status !== 'Cancelled' && b.status !== 'CheckedOut'
}

// Upcoming = a future-or-today arrival that is still confirmed/pending.
export function isUpcoming(b) {
  return b.fromDate >= TODAY && (b.status === 'Confirmed' || b.status === 'Pending')
}

// ── Guest phone numbers ──
// A booking stores every number the guest left in one comma-separated
// guestPhone string (the same way idType lists multiple IDs), so the forms work
// with an array and only join on submit.
export const MAX_PHONES = 5

// Field name for the nth phone input — used for errors and "focus first error".
export const phoneFieldName = (i) => (i === 0 ? 'guestPhone' : `guestPhone${i + 1}`)

// Both phone numbers and guest names are stored the same way: one comma-joined
// column, split back into an array for the forms.
export const splitList = (s) => (s || '').split(',').map((x) => x.trim()).filter(Boolean)

export const joinList = (list) => (list || []).map((x) => x.trim()).filter(Boolean).join(', ')

export const splitPhones = splitList

export const joinPhones = joinList

// Validate a phone list into { [fieldName]: message } — 10 digits each, no
// repeats. One number is required (it's how a returning guest is recognised);
// the extra rows are optional.
export function phoneErrors(list) {
  const e = {}
  if (!(list || [])[0]) e[phoneFieldName(0)] = 'Phone number is required'
  ;(list || []).forEach((p, i) => {
    if (!p) return
    if (p.length !== 10) e[phoneFieldName(i)] = 'Enter a valid 10-digit number'
    else if (list.indexOf(p) !== i) e[phoneFieldName(i)] = 'Already added above'
  })
  return e
}

// ── Guest names ──
// A booking can be for more than one person (a couple, a family, colleagues
// sharing a room). The extra names ride in the same comma-separated guestName
// column, so the first entry is always the guest the booking is billed to.
export const MAX_NAMES = 5

export const nameFieldName = (i) => (i === 0 ? 'guestName' : `guestName${i + 1}`)

export const splitNames = splitList

export const joinNames = joinList

// Validate a name list into { [fieldName]: message }. Only the first name is
// required — an empty extra row is simply dropped on submit. Commas are barred
// because that is the separator the column is joined with.
export function nameErrors(list) {
  const e = {}
  const names = list || []
  if (!names[0]?.trim()) e[nameFieldName(0)] = 'Guest name is required'
  names.forEach((n, i) => {
    const name = (n || '').trim()
    if (!name) return
    if (name.includes(',')) e[nameFieldName(i)] = 'Use a separate row for each name'
    else if (name.length < 2) e[nameFieldName(i)] = 'Enter the full name'
    else if (names.findIndex((x) => (x || '').trim().toLowerCase() === name.toLowerCase()) !== i)
      e[nameFieldName(i)] = 'Already added above'
  })
  return e
}
