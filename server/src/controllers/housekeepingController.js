import prisma from '../utils/prisma.js'

export const getBoard = async (req, res) => {
  try {
    const rooms = await prisma.room.findMany({
      include: { type: true, housekeepingStatus: true },
      where: { status: { not: 'deleted' } },
      orderBy: [{ floor: 'asc' }, { number: 'asc' }]
    })
    res.json(rooms)
  } catch (e) { res.status(500).json({ error: e.message }) }
}

export const updateRoomStatus = async (req, res) => {
  try {
    const { roomId } = req.params
    const { status, assignedTo, startedAt, completedAt } = req.body
    const hk = await prisma.housekeepingStatus.upsert({
      where: { roomId }, update: { status, assignedTo, startedAt, completedAt },
      create: { roomId, status, assignedTo }
    })
    res.json(hk)
  } catch (e) { res.status(500).json({ error: e.message }) }
}

export const getDailyList = async (req, res) => {
  try {
    const rooms = await prisma.room.findMany({
      include: { housekeepingStatus: true, type: true },
      where: { housekeepingStatus: { status: { in: ['dirty_available', 'cleaning_in_progress', 'checkout_pending'] } } }
    })
    res.json(rooms)
  } catch (e) { res.status(500).json({ error: e.message }) }
}

export const getLinenTracker = async (req, res) => {
  try {
    const records = await prisma.linenRecord.findMany({ orderBy: { nextDue: 'asc' } })
    res.json(records)
  } catch (e) { res.status(500).json({ error: e.message }) }
}

export const markLinenChanged = async (req, res) => {
  try {
    const { roomId } = req.params
    const { changedBy, frequency = 7 } = req.body
    const lastChanged = new Date()
    const nextDue = new Date(lastChanged)
    nextDue.setDate(nextDue.getDate() + frequency)
    const record = await prisma.linenRecord.create({ data: { roomId, lastChanged, nextDue, changedBy } })
    res.json(record)
  } catch (e) { res.status(500).json({ error: e.message }) }
}

export const submitInspection = async (req, res) => {
  try {
    const { roomId, staffId, checklist } = req.body
    const inspection = await prisma.roomInspection.create({ data: { roomId, staffId, checklist } })
    res.status(201).json(inspection)
  } catch (e) { res.status(500).json({ error: e.message }) }
}
