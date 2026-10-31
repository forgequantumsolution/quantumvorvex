import { bedLabel, isTenancy } from './beds'

/**
 * Flatten an API booking (where `room` is a nested object) into the flat shape
 * the booking/check-in/check-out/cancellation UIs read. Safe on already-flat
 * (mock) records too.
 */
export function normalizeBooking(b) {
  if (!b) return b
  return {
    ...b,
    roomNumber: typeof b.room === 'object' ? b.room?.number : b.room,
    roomType: b.room?.type?.name || b.roomType || '',
    // "B" for a PG bed booking, '' for a whole-room stay.
    bed: b.bedNo ? bedLabel(b.bedNo) : '',
    tenancy: isTenancy(b),
    // Rent months unpaid past the grace period (server marks them Overdue).
    rentOverdue: (b.invoices || []).reduce((n, i) => n + (i.total - i.amountPaid), 0),
    // Days since the oldest overdue month was billed (computed at load time).
    overdueDays: b.invoices?.[0]
      ? Math.max(1, Math.floor((Date.now() - new Date(b.invoices[0].createdAt)) / 86400000))
      : 0,
    balanceDue: b.balance != null ? b.balance : Math.max(0, (b.amount || 0) - (b.advance || 0)),
    guests: (b.adults || 0) + (b.children || 0) || b.guests || 1,
  }
}
