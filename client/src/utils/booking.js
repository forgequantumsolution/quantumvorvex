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
  if (b.stayType === 'monthly') return `${b.months} month${b.months !== 1 ? 's' : ''}`
  return `${b.nights} night${b.nights !== 1 ? 's' : ''}`
}

// "08 Jun → 11 Jun" or "from 08 Jun (monthly)".
export function dateRangeLabel(b) {
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
