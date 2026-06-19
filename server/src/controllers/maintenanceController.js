import prisma from '../utils/prisma.js'
import logger from '../utils/logger.js'

const YEAR = 2026

// Ticket number: MT-2026-001 (derived from the highest existing number).
export const generateTicketNo = async () => {
  const last = await prisma.maintenanceRequest.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { ticketNo: true },
  })
  const lastNum = last?.ticketNo?.match(/(\d+)$/)?.[1]
  const next = (lastNum ? parseInt(lastNum, 10) : 0) + 1
  return `MT-${YEAR}-${String(next).padStart(3, '0')}`
}

const include = {
  room: { include: { type: true } },
  notes: { orderBy: { createdAt: 'asc' } },
}

// GET /maintenance?status=&priority=&q=
export const getRequests = async (req, res) => {
  try {
    const { status, priority, q } = req.query
    const where = {}
    if (status && status !== 'all') where.status = status
    if (priority) where.priority = priority
    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { ticketNo: { contains: q, mode: 'insensitive' } },
        { category: { contains: q, mode: 'insensitive' } },
        { room: { number: { contains: q, mode: 'insensitive' } } },
      ]
    }
    const requests = await prisma.maintenanceRequest.findMany({
      where, include, orderBy: { createdAt: 'desc' },
    })
    res.json({ requests, total: requests.length })
  } catch (e) {
    logger.error('getRequests error', { error: e.message })
    res.status(500).json({ message: 'Internal server error.' })
  }
}

// POST /maintenance
export const createRequest = async (req, res) => {
  try {
    const { roomId, category, title, description, priority, reportedBy, assignedTo, photoUrl } = req.body
    const room = await prisma.room.findUnique({ where: { id: roomId } })
    if (!room) return res.status(404).json({ message: 'Room not found.', code: 'ERR_ROOM_NOT_FOUND' })

    const ticketNo = await generateTicketNo()
    const request = await prisma.maintenanceRequest.create({
      data: {
        ticketNo,
        roomId,
        category: category || 'Other',
        issueType: category || 'Other',
        title,
        description: description ?? null,
        priority: priority || 'Medium',
        reportedBy: reportedBy || 'Front Desk',
        assignedTo: assignedTo ?? null,
        photoUrl: photoUrl ?? null,
      },
      include,
    })

    // Keep the room board in sync: a new ticket puts the room into maintenance.
    if (room.status !== 'maintenance') {
      await prisma.room.update({ where: { id: roomId }, data: { status: 'maintenance' } })
    }

    // Alert the team on high-severity issues
    if (priority === 'High' || priority === 'Urgent') {
      await prisma.notification.create({
        data: { type: 'danger', message: `${priority} maintenance: ${title} in Room ${room.number} (${ticketNo})` },
      })
    }

    logger.info('Maintenance ticket created', { event: 'MAINTENANCE', ticketNo })
    res.status(201).json({ request })
  } catch (e) {
    logger.error('createRequest error', { error: e.message })
    res.status(500).json({ message: 'Internal server error.' })
  }
}

// GET /maintenance/public/room?t=<qrToken>  (public — no auth)
// Lets the guest QR page confirm the room before the guest submits a ticket.
export const getPublicRoom = async (req, res) => {
  try {
    const token = req.query.t
    if (!token) return res.status(400).json({ message: 'Missing QR token.', code: 'ERR_QR_MISSING' })
    const room = await prisma.room.findUnique({
      where: { qrToken: String(token) },
      select: { number: true, floor: true },
    })
    if (!room) return res.status(404).json({ message: 'This QR code is not recognised.', code: 'ERR_QR_INVALID' })
    res.json({ room })
  } catch (e) {
    logger.error('getPublicRoom error', { error: e.message })
    res.status(500).json({ message: 'Internal server error.' })
  }
}

// POST /maintenance/public  (public — no auth)
// A guest scans the in-room QR and reports an issue. Room is resolved from the
// token; reportedBy/priority/status are forced server-side and never trusted.
export const createGuestRequest = async (req, res) => {
  try {
    const { qrToken, category, title, description } = req.body
    const room = await prisma.room.findUnique({ where: { qrToken } })
    if (!room) return res.status(404).json({ message: 'This QR code is not recognised.', code: 'ERR_QR_INVALID' })

    const ticketNo = await generateTicketNo()
    const request = await prisma.maintenanceRequest.create({
      data: {
        ticketNo,
        roomId: room.id,
        category: category || 'Other',
        issueType: category || 'Other',
        title,
        description: description ?? null,
        priority: 'Medium',
        reportedBy: `Guest – Room ${room.number}`,
        status: 'Open',
      },
      include,
    })

    // A guest-reported issue also moves the room into maintenance.
    if (room.status !== 'maintenance') {
      await prisma.room.update({ where: { id: room.id }, data: { status: 'maintenance' } })
    }

    // Surface guest-reported issues to the team.
    await prisma.notification.create({
      data: { type: 'info', message: `Guest reported: ${title} in Room ${room.number} (${ticketNo})` },
    })

    logger.info('Guest maintenance ticket created', { event: 'MAINTENANCE', ticketNo, source: 'guest-qr' })
    res.status(201).json({ ticketNo, room: { number: room.number } })
  } catch (e) {
    logger.error('createGuestRequest error', { error: e.message })
    res.status(500).json({ message: 'Internal server error.' })
  }
}

// PUT /maintenance/:id
export const updateRequest = async (req, res) => {
  try {
    const { id } = req.params
    const data = { ...req.body }
    if (data.category) data.issueType = data.category
    if (data.status === 'Resolved') data.resolvedAt = new Date()
    if (data.status && data.status !== 'Resolved') data.resolvedAt = null

    const request = await prisma.maintenanceRequest.update({ where: { id }, data, include })

    // When a ticket is resolved, release the room back to available — but only
    // if it's currently in maintenance and has no other unresolved tickets.
    if (data.status === 'Resolved' && request.room?.status === 'maintenance') {
      const stillOpen = await prisma.maintenanceRequest.findFirst({
        where: { roomId: request.roomId, status: { not: 'Resolved' } },
      })
      if (!stillOpen) {
        await prisma.room.update({ where: { id: request.roomId }, data: { status: 'available' } })
      }
    }

    res.json({ request })
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ message: 'Ticket not found.' })
    logger.error('updateRequest error', { error: e.message })
    res.status(500).json({ message: 'Internal server error.' })
  }
}

// POST /maintenance/:id/notes
export const addNote = async (req, res) => {
  try {
    const { id } = req.params
    const { author, content } = req.body
    const exists = await prisma.maintenanceRequest.findUnique({ where: { id }, select: { id: true } })
    if (!exists) return res.status(404).json({ message: 'Ticket not found.' })

    await prisma.maintenanceNote.create({ data: { requestId: id, author: author || 'Staff', content } })
    const request = await prisma.maintenanceRequest.findUnique({ where: { id }, include })
    res.status(201).json({ request })
  } catch (e) {
    logger.error('addNote error', { error: e.message })
    res.status(500).json({ message: 'Internal server error.' })
  }
}

// DELETE /maintenance/:id
export const deleteRequest = async (req, res) => {
  try {
    await prisma.maintenanceNote.deleteMany({ where: { requestId: req.params.id } })
    await prisma.maintenanceRequest.delete({ where: { id: req.params.id } })
    res.json({ message: 'Ticket deleted.' })
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ message: 'Ticket not found.' })
    logger.error('deleteRequest error', { error: e.message })
    res.status(500).json({ message: 'Internal server error.' })
  }
}

// GET /maintenance/schedule
export const getSchedules = async (req, res) => {
  try {
    const schedules = await prisma.maintenanceSchedule.findMany({ orderBy: { nextDue: 'asc' } })
    res.json({ schedules })
  } catch (e) {
    logger.error('getSchedules error', { error: e.message })
    res.status(500).json({ message: 'Internal server error.' })
  }
}

// POST /maintenance/schedule
export const createSchedule = async (req, res) => {
  try {
    const schedule = await prisma.maintenanceSchedule.create({ data: req.body })
    res.status(201).json({ schedule })
  } catch (e) {
    logger.error('createSchedule error', { error: e.message })
    res.status(500).json({ message: 'Internal server error.' })
  }
}
