/**
 * Bed helpers. A room with 2+ beds (`bedCount`) can be booked whole or bed by
 * bed (PG) — decided per booking. Beds are numbered 1..bedCount, shown A, B, C…
 * (mirrors bedLabel in server/src/controllers/bookingsController.js).
 */

export const bedLabel = (n) => (n >= 1 && n <= 26 ? String.fromCharCode(64 + n) : String(n))

// Room that can be booked bed by bed (it has more than one bed).
export const isBedRoom = (room) => (room?.bedCount || 1) > 1

// Room currently let (or booked) bed by bed — show its beds, not just a status.
export const hasBedStays = (room) => (room?.bookings || []).some((b) => b.bedNo != null)

// A monthly tenancy (PG bed or whole room let by the month): booked once,
// open-ended until move-out, one rent invoice per month collected on the
// booking. Older monthly bookings with a fixed `months` term are not.
export const isTenancy = (b) => b?.stayType === 'monthly' && !b?.months

// One wording for a PG room's fill level everywhere: "2/3 beds free" / "Full · 3/3 beds".
export const bedFillLabel = (free, total) =>
  free > 0 ? `${free}/${total} beds free` : `Full · ${total}/${total} beds`

/**
 * Who is in each bed of a room right now, from the live stays the rooms API
 * attaches (`room.bookings`). A whole-room stay (bedNo null) fills every bed.
 * Returns [{ bedNo, label, state: 'in' | 'booked' | 'free', booking }].
 */
export function bedOccupancy(room) {
  const count = isBedRoom(room) ? room.bedCount || 1 : 1
  const stays = room?.bookings || []
  return Array.from({ length: count }, (_, i) => {
    const bedNo = i + 1
    const holds = (b) => b.bedNo == null || b.bedNo === bedNo
    const inHouse = stays.find((b) => b.status === 'CheckedIn' && holds(b))
    const booked = !inHouse && stays.find((b) => b.status !== 'CheckedIn' && holds(b))
    return {
      bedNo,
      label: bedLabel(bedNo),
      state: inHouse ? 'in' : booked ? 'booked' : 'free',
      booking: inHouse || booked || null,
    }
  })
}
