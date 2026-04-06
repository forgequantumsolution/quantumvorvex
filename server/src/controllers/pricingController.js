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
