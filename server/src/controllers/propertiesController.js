import prisma from '../utils/prisma.js'
import logger from '../utils/logger.js'
import { audit } from '../utils/audit.js'
import { runWithProperty } from '../utils/propertyContext.js'
import { createProperty as createPropertyRecord } from '../utils/properties.js'
import { getUserAccess, listPropertyAccess, bustProperties, bustUser } from '../utils/permissionCache.js'

// Client shape for one accessible property: identity + the caller's role there.
export const shapePropertyAccess = (pa) => ({
  id:          pa.property.id,
  name:        pa.property.name,
  code:        pa.property.code,
  status:      pa.property.status,
  roleName:    pa.roleName,
  isOwner:     pa.isOwner,
  permissions: pa.perms,
})

// GET /properties — the properties the caller can open (powers the switcher).
export const listProperties = async (req, res) => {
  try {
    const access = await getUserAccess(req.user.userId)
    res.json((await listPropertyAccess(access)).map(shapePropertyAccess))
  } catch (e) {
    logger.error('listProperties error', { error: e.message })
    res.status(500).json({ error: 'Internal server error.' })
  }
}

const DAY_MS = 24 * 60 * 60 * 1000
export const FORECAST_DAYS = 14
export const TREND_DAYS = 30
const LIVE_BOOKING = ['Pending', 'Confirmed', 'CheckedIn']
const round2 = (n) => Math.round(n * 100) / 100
// Calendar date in server-local time (toISOString would shift to UTC — a day early in IST).
const localDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// Same stay-end rule as bookingsController: open monthly stays run months × 30 days.
const stayEnd = ({ stayType, fromDate, toDate, months }) => {
  if (toDate) return new Date(toDate)
  if (stayType === 'monthly' && months) return new Date(new Date(fromDate).getTime() + months * 30 * DAY_MS)
  return new Date(new Date(fromDate).getTime() + DAY_MS)
}
// Nightly rate of a stay (monthly rates spread over 30 nights) — basis for ADR/RevPAR.
const nightlyRate = (stayType, rate) => (stayType === 'monthly' ? (rate || 0) / 30 : rate || 0)

// Headline numbers for one property (runs inside that property's context).
//
// Hotel KPIs, "tonight" = the current night:
//   occupancy  = occupied rooms / sellable rooms (out-of-order rooms excluded)
//   ADR        = room revenue tonight / rooms sold tonight
//   RevPAR     = room revenue tonight / sellable rooms
// forecast[i]  = rooms on the books for night i (day 0 = tonight's actual), from
//                live bookings plus in-house guests, de-duplicated per room.
// collections[i] = payments received on day i of the last TREND_DAYS (oldest first);
// paymentMethods = this month's collections by method; roomTypes = rooms and
// occupied rooms per room type; stayMix = in-house stays by stay type.
async function propertyStats() {
  const now = new Date()
  const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(dayStart.getTime() + DAY_MS)
  const horizon = new Date(dayStart.getTime() + FORECAST_DAYS * DAY_MS)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const trendStart = new Date(dayStart.getTime() - (TREND_DAYS - 1) * DAY_MS)

  const [roomList, recentPayments, methodTotals, roomsByStatus, inHouse, arrivalsToday, departuresToday, collectedMonth, collectedToday, open, liveBookings, activeGuests] = await Promise.all([
    prisma.room.findMany({ where: { deletedAt: null }, select: { status: true, type: { select: { name: true } } } }),
    prisma.payment.findMany({ where: { createdAt: { gte: trendStart } }, select: { amount: true, createdAt: true } }),
    prisma.payment.groupBy({ by: ['method'], where: { createdAt: { gte: monthStart } }, _sum: { amount: true } }),
    prisma.room.groupBy({ by: ['status'], where: { deletedAt: null }, _count: { _all: true } }),
    prisma.booking.findMany({ where: { status: 'CheckedIn', deletedAt: null }, select: { stayType: true, roomRate: true } }),
    prisma.booking.count({ where: { status: { in: ['Pending', 'Confirmed'] }, deletedAt: null, fromDate: { gte: dayStart, lt: dayEnd } } }),
    prisma.booking.count({ where: { status: 'CheckedIn', deletedAt: null, toDate: { gte: dayStart, lt: dayEnd } } }),
    prisma.payment.aggregate({ where: { createdAt: { gte: monthStart } }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { createdAt: { gte: dayStart } }, _sum: { amount: true } }),
    prisma.invoice.aggregate({ where: { status: { not: 'Paid' }, deletedAt: null }, _sum: { total: true, amountPaid: true } }),
    prisma.booking.findMany({
      where: { status: { in: LIVE_BOOKING }, deletedAt: null, fromDate: { lt: horizon }, room: { deletedAt: null } },
      select: { roomId: true, stayType: true, fromDate: true, toDate: true, months: true },
    }),
    prisma.guest.findMany({
      where: { status: { in: ['Active', 'Due'] }, deletedAt: null, room: { deletedAt: null } },
      select: { roomId: true, checkInDate: true, checkOutDate: true },
    }),
  ])

  const rooms = Object.fromEntries(roomsByStatus.map((r) => [r.status, r._count._all]))
  const totalRooms = roomsByStatus.reduce((n, r) => n + r._count._all, 0)
  const outOfOrder = rooms.maintenance || 0
  const sellable = Math.max(totalRooms - outOfOrder, 0)
  const occupied = rooms.occupied || 0

  const roomRevenue = inHouse.reduce((sum, b) => sum + nightlyRate(b.stayType, b.roomRate), 0)
  const roomsSold = inHouse.length

  // Rooms on the books per night. A stay occupies night d when from <= d < end.
  const stays = [
    ...liveBookings.map((b) => ({ roomId: b.roomId, from: new Date(b.fromDate), to: stayEnd(b) })),
    ...activeGuests.map((g) => ({ roomId: g.roomId, from: new Date(g.checkInDate), to: g.checkOutDate ? new Date(g.checkOutDate) : horizon })),
  ]
  const forecast = Array.from({ length: FORECAST_DAYS }, (_, i) => {
    const night = new Date(dayStart.getTime() + i * DAY_MS)
    const booked = i === 0
      ? occupied
      : Math.min(new Set(stays.filter((s) => s.from <= night && s.to > night).map((s) => s.roomId)).size, totalRooms)
    return { date: localDate(night), booked }
  })

  const collections = Array.from({ length: TREND_DAYS }, (_, i) => ({
    date: localDate(new Date(trendStart.getTime() + i * DAY_MS)), amount: 0,
  }))
  const dayIndex = Object.fromEntries(collections.map((c, i) => [c.date, i]))
  for (const p of recentPayments) {
    const i = dayIndex[localDate(new Date(p.createdAt))]
    if (i !== undefined) collections[i].amount = round2(collections[i].amount + (p.amount || 0))
  }

  const byType = {}
  for (const r of roomList) {
    const name = r.type?.name || 'Other'
    byType[name] ??= { type: name, total: 0, occupied: 0 }
    byType[name].total += 1
    if (r.status === 'occupied') byType[name].occupied += 1
  }

  return {
    collections,
    paymentMethods: methodTotals
      .map((m) => ({ method: m.method || 'other', amount: round2(m._sum.amount || 0) }))
      .filter((m) => m.amount > 0),
    roomTypes: Object.values(byType),
    stayMix: {
      daily: inHouse.filter((b) => b.stayType !== 'monthly').length,
      monthly: inHouse.filter((b) => b.stayType === 'monthly').length,
    },
    rooms: { total: totalRooms, sellable, available: rooms.available || 0, occupied, outOfOrder, reserved: rooms.reserved || 0 },
    occupancyRate: sellable ? Math.round((occupied / sellable) * 1000) / 10 : 0,
    adr: roomsSold ? round2(roomRevenue / roomsSold) : 0,
    revpar: sellable ? round2(roomRevenue / sellable) : 0,
    roomRevenueTonight: round2(roomRevenue),
    inHouse: roomsSold,
    arrivalsToday,
    departuresToday,
    collectedToday: collectedToday._sum.amount || 0,
    collectedThisMonth: collectedMonth._sum.amount || 0,
    outstanding: round2((open._sum.total || 0) - (open._sum.amountPaid || 0)),
    forecast,
  }
}

// Combine per-property rows that share a key (e.g. room type "Deluxe" at two
// properties) by summing the given numeric fields.
const mergeBy = (rows, key, fields) => Object.values(rows.reduce((acc, row) => {
  const k = row[key]
  acc[k] ??= { [key]: k, ...Object.fromEntries(fields.map((f) => [f, 0])) }
  for (const f of fields) acc[k][f] = round2(acc[k][f] + (row[f] || 0))
  return acc
}, {}))

// GET /properties/summary — portfolio view: headline numbers for every property
// the caller can open, plus totals. Owners see all; managers see their own.
export const getPortfolioSummary = async (req, res) => {
  try {
    const access = await getUserAccess(req.user.userId)
    const accessible = (await listPropertyAccess(access)).filter((pa) => pa.isOwner || pa.perms.reports === 'VIEW' || pa.perms.reports === 'MANAGE')

    const properties = await Promise.all(accessible.map(async (pa) => ({
      ...shapePropertyAccess(pa),
      stats: await runWithProperty(pa.property.id, propertyStats),
    })))

    // Portfolio totals cover active properties only; archived ones are history.
    const live = properties.filter((p) => p.status === 'active')
    const sum = (fn) => live.reduce((n, p) => n + fn(p.stats), 0)
    const totalRooms = sum((s) => s.rooms.total)
    const sellable = sum((s) => s.rooms.sellable)
    const occupied = sum((s) => s.rooms.occupied)
    const roomRevenue = sum((s) => s.roomRevenueTonight)
    const roomsSold = sum((s) => s.inHouse)
    res.json({
      generatedAt: new Date().toISOString(),
      properties,
      totals: {
        properties: live.length,
        rooms: totalRooms,
        sellable,
        occupied,
        outOfOrder: sum((s) => s.rooms.outOfOrder),
        occupancyRate: sellable ? +((occupied / sellable) * 100).toFixed(1) : 0,
        adr: roomsSold ? +(roomRevenue / roomsSold).toFixed(2) : 0,
        revpar: sellable ? +(roomRevenue / sellable).toFixed(2) : 0,
        inHouse: roomsSold,
        arrivalsToday: sum((s) => s.arrivalsToday),
        departuresToday: sum((s) => s.departuresToday),
        collectedToday: +sum((s) => s.collectedToday).toFixed(2),
        collectedThisMonth: +sum((s) => s.collectedThisMonth).toFixed(2),
        outstanding: +sum((s) => s.outstanding).toFixed(2),
        available: sum((s) => s.rooms.available),
        reserved: sum((s) => s.rooms.reserved),
        collections: Array.from({ length: TREND_DAYS }, (_, i) => ({
          date: live[0]?.stats.collections[i]?.date ?? null,
          amount: +sum((s) => s.collections[i]?.amount || 0).toFixed(2),
        })),
        paymentMethods: mergeBy(live.flatMap((p) => p.stats.paymentMethods), 'method', ['amount']),
        roomTypes: mergeBy(live.flatMap((p) => p.stats.roomTypes), 'type', ['total', 'occupied']),
        stayMix: { daily: sum((s) => s.stayMix.daily), monthly: sum((s) => s.stayMix.monthly) },
        // Portfolio "on the books" per night, against sellable rooms.
        forecast: Array.from({ length: FORECAST_DAYS }, (_, i) => ({
          date: live[0]?.stats.forecast[i]?.date ?? null,
          booked: sum((s) => s.forecast[i]?.booked || 0),
        })),
      },
    })
  } catch (e) {
    logger.error('getPortfolioSummary error', { error: e.message })
    res.status(500).json({ error: 'Internal server error.' })
  }
}

// POST /properties (owner) — create a property with settings and a starter catalog.
export const createProperty = async (req, res) => {
  try {
    const { copyFromPropertyId } = req.body
    if (copyFromPropertyId && !(await prisma.property.findUnique({ where: { id: copyFromPropertyId }, select: { id: true } }))) {
      return res.status(400).json({ error: 'The property to copy from does not exist.' })
    }
    const property = await createPropertyRecord(req.body)
    await audit(req, 'property.create', { entity: 'property', entityId: property.id, detail: `${property.code} ${property.name}` })
    res.status(201).json(property)
  } catch (e) {
    if (e.code === 'P2002') return res.status(409).json({ error: 'A property with that code already exists.' })
    logger.error('createProperty error', { error: e.message })
    res.status(500).json({ error: 'Internal server error.' })
  }
}

// PUT /properties/:id (owner) — rename, change code, archive / restore.
export const updateProperty = async (req, res) => {
  try {
    const { id } = req.params
    const { name, code, status } = req.body

    const existing = await prisma.property.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: 'Property not found.' })

    // Never archive the last active property — the app would have nowhere to work.
    if (status === 'archived' && existing.status === 'active') {
      const active = await prisma.property.count({ where: { status: 'active' } })
      if (active <= 1) return res.status(400).json({ error: 'Cannot archive the only active property.' })
    }

    const data = {}
    if (name !== undefined)   data.name = name
    if (code !== undefined)   data.code = code
    if (status !== undefined) data.status = status
    const property = await prisma.property.update({ where: { id }, data })
    bustProperties()

    if (status !== undefined && status !== existing.status) {
      await audit(req, `property.${status === 'archived' ? 'archive' : 'restore'}`, { entity: 'property', entityId: id, detail: property.name })
    } else {
      await audit(req, 'property.update', { entity: 'property', entityId: id, detail: property.name })
    }
    res.json(property)
  } catch (e) {
    if (e.code === 'P2002') return res.status(409).json({ error: 'A property with that code already exists.' })
    logger.error('updateProperty error', { error: e.message })
    res.status(500).json({ error: 'Internal server error.' })
  }
}

// GET /properties/:id/members (owner) — who can open this property, with their role there.
export const getPropertyMembers = async (req, res) => {
  try {
    const { id } = req.params
    if (!(await prisma.property.findUnique({ where: { id }, select: { id: true } }))) {
      return res.status(404).json({ error: 'Property not found.' })
    }
    const [members, owners] = await Promise.all([
      prisma.propertyAccess.findMany({
        where: { propertyId: id },
        include: {
          user: { select: { id: true, name: true, email: true, status: true } },
          role: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.user.findMany({
        where: { roleRef: { isOwner: true } },
        select: { id: true, name: true, email: true, status: true },
      }),
    ])
    res.json({
      owners,   // implicit access to every property
      members: members.map((m) => ({ ...m.user, roleId: m.role.id, roleName: m.role.name })),
    })
  } catch (e) {
    logger.error('getPropertyMembers error', { error: e.message })
    res.status(500).json({ error: 'Internal server error.' })
  }
}

// PUT /properties/:id/members/:userId (owner) — give a person access to this
// property with a role (e.g. Receptionist, Manager), or change their role here.
export const setPropertyMember = async (req, res) => {
  try {
    const { id, userId } = req.params
    const { roleId } = req.body

    const [property, user, role] = await Promise.all([
      prisma.property.findUnique({ where: { id }, select: { id: true, name: true } }),
      prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, roleRef: { select: { isOwner: true } } } }),
      prisma.role.findUnique({ where: { id: roleId }, select: { id: true, name: true, isOwner: true } }),
    ])
    if (!property) return res.status(404).json({ error: 'Property not found.' })
    if (!user) return res.status(404).json({ error: 'User not found.' })
    if (!role) return res.status(400).json({ error: 'Selected role does not exist.' })
    if (user.roleRef?.isOwner) return res.status(400).json({ error: 'Owners already have access to every property.' })
    if (role.isOwner) {
      return res.status(400).json({ error: 'Owner is an organisation-wide role; change the user\'s role in Users & Roles instead.' })
    }

    await prisma.propertyAccess.upsert({
      where:  { userId_propertyId: { userId, propertyId: id } },
      update: { roleId },
      create: { userId, propertyId: id, roleId },
    })
    bustUser(userId)
    await audit(req, 'user.access_set', { entity: 'user', entityId: userId, detail: `${user.email} → ${role.name} @ ${property.name}` })
    res.json({ success: true })
  } catch (e) {
    logger.error('setPropertyMember error', { error: e.message })
    res.status(500).json({ error: 'Internal server error.' })
  }
}

// DELETE /properties/:id/members/:userId (owner) — remove a person's access to
// this property (their account and other properties are untouched).
export const removePropertyMember = async (req, res) => {
  try {
    const { id, userId } = req.params
    const removed = await prisma.propertyAccess.deleteMany({ where: { userId, propertyId: id } })
    if (!removed.count) return res.status(404).json({ error: 'This person does not have access to the property.' })
    bustUser(userId)
    await audit(req, 'user.access_remove', { entity: 'user', entityId: userId, detail: `@ ${id}` })
    res.json({ success: true })
  } catch (e) {
    logger.error('removePropertyMember error', { error: e.message })
    res.status(500).json({ error: 'Internal server error.' })
  }
}
