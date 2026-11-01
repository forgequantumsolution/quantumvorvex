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

const parseDay = (s) => new Date(String(s).includes('T') ? s : `${s}T00:00:00`)

// Months of rent billed when a tenancy moves in on `fromDate`: the first calendar
// month by the day, plus any full months already started (mirrors server pgRent.js).
export function rentMonthsAtMoveIn(fromDate, today = new Date()) {
  const start = parseDay(fromDate)
  if (Number.isNaN(start.getTime())) return 1
  const inMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate()
  let months = (inMonth - start.getDate() + 1) / inMonth
  for (let d = new Date(start.getFullYear(), start.getMonth() + 1, 1); d <= today; d.setMonth(d.getMonth() + 1)) months += 1
  return months
}

// "25–31 Oct is charged for 7 of 31 days" — null when moving in on the 1st.
export function rentFirstMonthNote(fromDate) {
  const start = parseDay(fromDate)
  if (Number.isNaN(start.getTime()) || start.getDate() === 1) return null
  const inMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate()
  const month = start.toLocaleDateString('en-IN', { month: 'short' })
  return `${start.getDate()}–${inMonth} ${month} is charged for ${inMonth - start.getDate() + 1} of ${inMonth} days. Full rent from the 1st of each month after.`
}

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
