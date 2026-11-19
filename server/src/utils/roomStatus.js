/**
 * A room's available ↔ occupied status, derived from who is actually staying in
 * it — never from the one stay that just started or ended. A room can hold
 * several stays at once (PG beds, open-ended tenancies, a guest checked in
 * straight from the Guests page), so checking one of them out must not free a
 * room someone else is still in.
 *
 * Occupants: checked-in bookings, plus Active/Due guest records that no
 * checked-in booking already covers (guests checked in without a booking).
 *   - whole room (1 bed): occupied while anyone is in it
 *   - room with beds:     occupied once every bed (or the whole room) is taken,
 *                         so a PG room with a free bed stays bookable
 * "maintenance" and "reserved" are set by hand and left alone — except that a
 * check-in (`checkIn: true`) takes a reserved room.
 */
import prisma from './prisma.js'
import logger from './logger.js'
import { runUnscoped } from './propertyContext.js'

const IN_HOUSE_GUEST = ['Active', 'Due']

export async function syncRoomOccupancy(db, roomId, { checkIn = false } = {}) {
  const room = await db.room.findUnique({ where: { id: roomId }, select: { id: true, status: true, bedCount: true } })
  if (!room) return null
  const managed = room.status === 'available' || room.status === 'occupied' || (checkIn && room.status === 'reserved')
  if (!managed) return room.status

  const [bookings, guests] = await Promise.all([
    db.booking.findMany({ where: { roomId, status: 'CheckedIn', deletedAt: null }, select: { bedNo: true, guestId: true } }),
    db.guest.findMany({ where: { roomId, status: { in: IN_HOUSE_GUEST }, deletedAt: null }, select: { id: true, bedNo: true } }),
  ])
  const covered = new Set(bookings.map((b) => b.guestId).filter(Boolean))
  const occupants = [...bookings, ...guests.filter((g) => !covered.has(g.id))]

  const beds = room.bedCount || 1
  const full = beds <= 1
    ? occupants.length > 0
    : occupants.some((o) => o.bedNo == null) || new Set(occupants.map((o) => o.bedNo)).size >= beds
  const next = full ? 'occupied' : room.status === 'reserved' ? 'reserved' : 'available'
  if (next !== room.status) await db.room.update({ where: { id: roomId }, data: { status: next } })
  return next
}

/** Re-derive every room's status (all properties). Run on boot to heal drift. */
export async function repairRoomStatuses() {
  try {
    const fixed = await runUnscoped(async () => {
      const rooms = await prisma.room.findMany({ where: { deletedAt: null }, select: { id: true, number: true, status: true } })
      const changed = []
      for (const r of rooms) {
        const next = await syncRoomOccupancy(prisma, r.id)
        if (next !== r.status) changed.push(`${r.number}: ${r.status} → ${next}`)
      }
      return changed
    })
    if (fixed.length) logger.info('Room statuses repaired', { event: 'ROOMS', changed: fixed })
  } catch (e) {
    logger.error('repairRoomStatuses error', { error: e.message })
  }
}
