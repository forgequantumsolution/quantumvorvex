import prisma from '../utils/prisma.js'

export const getRequests = async (req, res) => {
  try {
    const { status } = req.query
    const where = status ? { status } : {}
    const requests = await prisma.maintenanceRequest.findMany({
      where, include: { room: true, notes: { orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'desc' }
    })
    res.json(requests)
  } catch (e) { res.status(500).json({ error: e.message }) }
}

export const createRequest = async (req, res) => {
  try {
    const { roomId, issueType, description, priority, reportedBy, assignedTo, photoUrl } = req.body
    const request = await prisma.maintenanceRequest.create({
      data: { roomId, issueType, description, priority: priority || 'Medium', reportedBy, assignedTo, photoUrl },
      include: { room: true }
    })
    // Create notification for High priority
    if (priority === 'High') {
      await prisma.notification.create({ data: { type: 'danger', message: `High priority maintenance: ${issueType} in Room ${request.room.number}` } })
    }
    res.status(201).json(request)
  } catch (e) { res.status(500).json({ error: e.message }) }
}

export const updateRequest = async (req, res) => {
  try {
    const { id } = req.params
    const { status, assignedTo, resolvedAt } = req.body
    const data = { ...req.body }
    if (status === 'Resolved' && !data.resolvedAt) data.resolvedAt = new Date()
    const request = await prisma.maintenanceRequest.update({ where: { id }, data, include: { room: true } })
    res.json(request)
  } catch (e) { res.status(500).json({ error: e.message }) }
}

export const addNote = async (req, res) => {
  try {
    const { id } = req.params
    const { author, content } = req.body
    const note = await prisma.maintenanceNote.create({ data: { requestId: id, author, content } })
    res.status(201).json(note)
  } catch (e) { res.status(500).json({ error: e.message }) }
}

export const getSchedules = async (req, res) => {
  try {
    const schedules = await prisma.maintenanceSchedule.findMany({ orderBy: { nextDue: 'asc' } })
    res.json(schedules)
  } catch (e) { res.status(500).json({ error: e.message }) }
}

export const createSchedule = async (req, res) => {
  try {
    const schedule = await prisma.maintenanceSchedule.create({ data: req.body })
    res.status(201).json(schedule)
  } catch (e) { res.status(500).json({ error: e.message }) }
}
