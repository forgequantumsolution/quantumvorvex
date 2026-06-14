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
    balanceDue: b.balance != null ? b.balance : Math.max(0, (b.amount || 0) - (b.advance || 0)),
    guests: (b.adults || 0) + (b.children || 0) || b.guests || 1,
  }
}
