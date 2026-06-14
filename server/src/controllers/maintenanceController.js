import prisma from '../utils/prisma.js'
import logger from '../utils/logger.js'

const YEAR = 2026

// Ticket number: MT-2026-001 (derived from the highest existing number).
const generateTicketNo = async () => {
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

// PUT /maintenance/:id
export const updateRequest = async (req, res) => {
  try {
    const { id } = req.params
    const data = { ...req.body }
    if (data.category) data.issueType = data.category
    if (data.status === 'Resolved') data.resolvedAt = new Date()
    if (data.status && data.status !== 'Resolved') data.resolvedAt = null

    const request = await prisma.maintenanceRequest.update({ where: { id }, data, include })
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
