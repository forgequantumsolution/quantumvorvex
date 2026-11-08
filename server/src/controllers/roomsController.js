import crypto from 'crypto'
import prisma from '../utils/prisma.js'
import { generateTicketNo } from './maintenanceController.js'

// Unguessable per-room token embedded in the room's maintenance QR code.
export const generateQrToken = () => crypto.randomBytes(16).toString('hex')

// Bed fields (count + per-bed rents) from a create/update body. Returns { data } or { error }.
// Only keys present in the body are returned, so updates stay partial.
const bedFields = (body) => {
  const data = {}
  if (body.bedCount !== undefined) {
    const n = Number(body.bedCount)
    if (!Number.isInteger(n) || n < 1 || n > 50) return { error: 'Beds must be a whole number from 1 to 50.' }
    data.bedCount = n
  }
  // The room's own (whole-room) prices; a create without them uses the type's.
  for (const k of ['dailyRate', 'monthlyRate']) {
    if (body[k] === undefined || body[k] === null || body[k] === '') continue
    const v = Number(body[k])
    if (!Number.isFinite(v) || v <= 0) return { error: 'Room prices must be more than 0.' }
    data[k] = v
  }
  for (const k of ['bedDailyRate', 'bedMonthlyRate']) {
    if (body[k] === undefined) continue
    const v = body[k] === null || body[k] === '' ? null : Number(body[k])
    if (v !== null && (!Number.isFinite(v) || v < 0)) return { error: 'Bed rates must be zero or more.' }
    data[k] = v
  }
  return { data }
}

const LIVE = ['Pending', 'Confirmed', 'CheckedIn']

// Each room carries its live stays (in-house and upcoming) so the board can show
// who is in which bed without a second request.
const roomInclude = {
  type: true,
  bookings: {
    where: { deletedAt: null, status: { in: LIVE } },
    select: {
      id: true, bookingNo: true, bedNo: true, guestName: true, guestPhone: true, status: true,
      stayType: true, fromDate: true, toDate: true, roomRate: true, balance: true, securityDeposit: true,
    },
    orderBy: { fromDate: 'asc' },
  },
}

// GET /rooms?page=&pageSize=&status=&floor=&q=
// Pagination is opt-in: with page/pageSize one page of rooms comes back (filtered
// by status / floor / number-or-type search) plus `stats` over ALL rooms for the
// header — status counts, floors and bed occupancy. Without them every room is
// returned, for callers that need the full list (booking form, reports…).
export const getRooms = async (req, res) => {
  try {
    const hasPaging = req.query.page !== undefined || req.query.pageSize !== undefined
    if (!hasPaging) {
      const rooms = await prisma.room.findMany({
        where: { deletedAt: null },
        include: roomInclude,
        orderBy: { number: 'asc' },
      })
      return res.status(200).json({ rooms })
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 24))
    const { status, floor } = req.query
    const q = String(req.query.q || '').trim()

    const where = { deletedAt: null }
    if (status && status !== 'all') where.status = status
    if (floor && floor !== 'all' && !isNaN(parseInt(floor, 10))) where.floor = parseInt(floor, 10)
    if (q) {
      where.OR = [
        { number: { contains: q, mode: 'insensitive' } },
        { type: { name: { contains: q, mode: 'insensitive' } } },
      ]
    }

    const [rooms, total, byStatus, floors, bedRooms, inHouseBeds] = await Promise.all([
      prisma.room.findMany({
        where, include: roomInclude,
        orderBy: [{ floor: 'asc' }, { number: 'asc' }],
        skip: (page - 1) * pageSize, take: pageSize,
      }),
      prisma.room.count({ where }),
      prisma.room.groupBy({ by: ['status'], where: { deletedAt: null }, _count: { _all: true } }),
      prisma.room.findMany({ where: { deletedAt: null }, distinct: ['floor'], select: { floor: true }, orderBy: { floor: 'asc' } }),
      // Rooms currently let bed by bed, for the "beds taken / total" figure.
      prisma.room.findMany({
        where: { deletedAt: null, bookings: { some: { deletedAt: null, status: { in: LIVE }, bedNo: { not: null } } } },
        select: { id: true, bedCount: true },
      }),
      prisma.booking.findMany({
        where: { deletedAt: null, status: 'CheckedIn', bedNo: { not: null } },
        distinct: ['roomId', 'bedNo'], select: { roomId: true },
      }),
    ])

    const counts = Object.fromEntries(byStatus.map((g) => [g.status, g._count._all]))
    const bedRoomIds = new Set(bedRooms.map((r) => r.id))
    return res.status(200).json({
      rooms, total, page, pageSize,
      stats: {
        total: byStatus.reduce((n, g) => n + g._count._all, 0),
        counts,
        floors: floors.map((f) => f.floor),
        beds: {
          total: bedRooms.reduce((n, r) => n + r.bedCount, 0),
          taken: inHouseBeds.filter((b) => bedRoomIds.has(b.roomId)).length,
        },
      },
    })
  } catch (err) {
    console.error('getRooms error:', err)
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

// POST /rooms
export const createRoom = async (req, res) => {
  try {
    const { number, floor, status, dailyRate, monthlyRate, typeName, typeData } = req.body

    if (!number) {
      return res.status(400).json({ message: 'Room number is required.' })
    }
    const beds = bedFields(req.body)
    if (beds.error) return res.status(400).json({ message: beds.error })

    // Resolve or create RoomType
    let roomType
    if (typeName) {
      roomType = await prisma.roomType.upsert({
        where: { propertyId_name: { propertyId: req.propertyId, name: typeName } },
        update: typeData || {},
        create: {
          name: typeName,
          dailyRate: typeData?.dailyRate || dailyRate || 500,
          monthlyRate: typeData?.monthlyRate || monthlyRate || 10000,
          peakDailyRate: typeData?.peakDailyRate || 700,
          peakMonthlyRate: typeData?.peakMonthlyRate || 14000,
          maxOccupancy: typeData?.maxOccupancy || 2,
        },
      })
    } else {
      // Use first available type or create default
      roomType = await prisma.roomType.findFirst()
      if (!roomType) {
        roomType = await prisma.roomType.create({
          data: { name: 'Standard', dailyRate: 500, monthlyRate: 10000 },
        })
      }
    }

    const room = await prisma.room.create({
      data: {
        number,
        floor: floor || 1,
        status: status || 'available',
        dailyRate: dailyRate || roomType.dailyRate,
        monthlyRate: monthlyRate || roomType.monthlyRate,
        typeId: roomType.id,
        qrToken: generateQrToken(),
        ...beds.data,
      },
      include: { type: true },
    })

    return res.status(201).json({ room })
  } catch (err) {
    console.error('createRoom error:', err)
    if (err.code === 'P2002') {
      return res.status(409).json({ message: 'Room number already exists.' })
    }
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

// PUT /rooms/:id
export const updateRoom = async (req, res) => {
  try {
    const { id } = req.params
    const { number, floor, status, dailyRate, monthlyRate, typeName, typeId } = req.body

    const updateData = {}
    if (number !== undefined) updateData.number = number
    if (floor !== undefined) updateData.floor = floor
    if (status !== undefined) updateData.status = status
    if (dailyRate !== undefined) updateData.dailyRate = dailyRate
    if (monthlyRate !== undefined) updateData.monthlyRate = monthlyRate

    const beds = bedFields(req.body)
    if (beds.error) return res.status(400).json({ message: beds.error })
    Object.assign(updateData, beds.data)

    // Don't strand live bookings: a room can't lose a bed that a pending,
    // confirmed or in-house stay holds.
    if (beds.data.bedCount !== undefined) {
      const live = { roomId: id, deletedAt: null, status: { in: ['Pending', 'Confirmed', 'CheckedIn'] } }
      const stranded = await prisma.booking.findFirst({
        where: beds.data.bedCount > 1
          ? { ...live, bedNo: { gt: beds.data.bedCount } }
          : { ...live, bedNo: { not: null } },
        select: { bookingNo: true, bedNo: true },
      })
      if (stranded) {
        return res.status(409).json({
          message: `Booking ${stranded.bookingNo} still holds a bed in this room — move or close it first.`,
        })
      }
    }

    if (typeName) {
      const roomType = await prisma.roomType.upsert({
        where: { propertyId_name: { propertyId: req.propertyId, name: typeName } },
        update: {},
        create: { name: typeName },
      })
      updateData.typeId = roomType.id
    } else if (typeId) {
      // The type must belong to this property (the scoped lookup hides others).
      const roomType = await prisma.roomType.findUnique({ where: { id: typeId }, select: { id: true } })
      if (!roomType) return res.status(400).json({ message: 'Room type not found.' })
      updateData.typeId = typeId
    }

    const room = await prisma.room.update({
      where: { id },
      data: updateData,
      include: { type: true },
    })

    // When a room is moved into maintenance from the Rooms tab, open a matching
    // ticket so it surfaces in the Maintenance tab. Skip if the room already has
    // an unresolved ticket so we don't stack duplicates on repeated saves.
    if (status === 'maintenance') {
      const openTicket = await prisma.maintenanceRequest.findFirst({
        where: { roomId: id, status: { not: 'Resolved' } },
      })
      if (!openTicket) {
        const ticketNo = await generateTicketNo()
        await prisma.maintenanceRequest.create({
          data: {
            ticketNo,
            roomId: id,
            category: 'Other',
            issueType: 'Other',
            title: `Room ${room.number} marked for maintenance`,
            priority: 'Medium',
            reportedBy: 'Front Desk',
            status: 'Open',
          },
        })
      }
    }

    return res.status(200).json({ room })
  } catch (err) {
    console.error('updateRoom error:', err)
    if (err.code === 'P2002') {
      return res.status(409).json({ message: 'Room number already exists.' })
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ message: 'Room not found.' })
    }
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

// DELETE /rooms/:id
export const deleteRoom = async (req, res) => {
  try {
    const { id } = req.params
    const { hard } = req.query

    if (hard === 'true') {
      await prisma.room.delete({ where: { id } })
    } else {
      // Soft delete: stamp deletedAt so the room drops out of every list/board/
      // report while its record (bookings, QR token) is preserved.
      await prisma.room.update({
        where: { id },
        data: { deletedAt: new Date() },
      })
    }

    return res.status(200).json({ message: 'Room deleted successfully.' })
  } catch (err) {
    console.error('deleteRoom error:', err)
    if (err.code === 'P2025') {
      return res.status(404).json({ message: 'Room not found.' })
    }
    return res.status(500).json({ message: 'Internal server error.' })
  }
}
