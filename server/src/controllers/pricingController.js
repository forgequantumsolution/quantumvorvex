import prisma from '../utils/prisma.js'

export const getRules = async (req, res) => {
  try { res.json(await prisma.pricingRule.findMany({ orderBy: { createdAt: 'asc' } })) }
  catch (e) { res.status(500).json({ error: e.message }) }
}

export const saveRules = async (req, res) => {
  try {
    const { rules } = req.body
    await prisma.pricingRule.deleteMany()
    const created = await prisma.pricingRule.createMany({ data: rules })
    res.json({ success: true, count: created.count })
  } catch (e) { res.status(500).json({ error: e.message }) }
}

export const computeRate = async (req, res) => {
  try {
    const { roomId, stayType, months, checkIn, checkOut } = req.body
    const room = await prisma.room.findUnique({ where: { id: roomId }, include: { type: true } })
    if (!room) return res.status(404).json({ error: 'Room not found' })
    const baseRate = stayType === 'monthly' ? room.monthlyRate : room.dailyRate
    const rules = await prisma.pricingRule.findMany({ where: { active: true } })
    let finalRate = baseRate, appliedRule = null
    for (const rule of rules) {
      if (rule.triggerType === 'stay_length') {
        const stayDays = stayType === 'monthly' ? (months || 1) * 30 : Math.ceil((new Date(checkOut) - new Date(checkIn)) / 86400000)
        if (stayDays >= rule.threshold) {
          const adj = finalRate * (rule.adjustment / 100)
          finalRate = Math.round(finalRate + adj)
          appliedRule = { name: rule.name, adjustment: rule.adjustment }
        }
      }
    }
    res.json({ baseRate, finalRate, appliedRule, breakdown: `${baseRate} → ${finalRate}` })
  } catch (e) { res.status(500).json({ error: e.message }) }
}

// ─── Competitor rate benchmarking ─────────────────────────────────────────────

export const getCompetitors = async (req, res) => {
  try { res.json(await prisma.competitorRate.findMany({ orderBy: { recordedDate: 'desc' } })) }
  catch (e) { res.status(500).json({ error: e.message }) }
}

export const createCompetitor = async (req, res) => {
  try {
    const { name, roomType, theirRate } = req.body
    if (!name || !roomType || theirRate === undefined) {
      return res.status(400).json({ error: 'name, roomType and theirRate are required' })
    }
    const competitor = await prisma.competitorRate.create({
      data: { name, roomType, theirRate: parseFloat(theirRate) },
    })
    res.status(201).json(competitor)
  } catch (e) { res.status(500).json({ error: e.message }) }
}

export const updateCompetitor = async (req, res) => {
  try {
    const { id } = req.params
    const { name, roomType, theirRate } = req.body
    const data = {}
    if (name !== undefined) data.name = name
    if (roomType !== undefined) data.roomType = roomType
    if (theirRate !== undefined) data.theirRate = parseFloat(theirRate)
    const competitor = await prisma.competitorRate.update({ where: { id }, data })
    res.json(competitor)
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Competitor not found' })
    res.status(500).json({ error: e.message })
  }
}

export const deleteCompetitor = async (req, res) => {
  try {
    await prisma.competitorRate.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Competitor not found' })
    res.status(500).json({ error: e.message })
  }
}
