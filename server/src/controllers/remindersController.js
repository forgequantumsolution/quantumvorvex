import prisma from '../utils/prisma.js'

export const sendReminder = async (req, res) => {
  try {
    const { guestId, channel, message } = req.body
    const guest = await prisma.guest.findUnique({ where: { id: guestId } })
    if (!guest) return res.status(404).json({ error: 'Guest not found' })
    const reminder = await prisma.reminder.create({ data: { guestId, channel, message, status: 'sent', sentAt: new Date() } })
    // If no MESSAGING_PROVIDER configured, return wa.me fallback URL
    const fallbackUrl = channel === 'whatsapp' ? `https://wa.me/91${guest.phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}` : null
    res.json({ reminder, fallbackUrl })
  } catch (e) { res.status(500).json({ error: e.message }) }
}

export const getTemplates = async (req, res) => {
  try { res.json(await prisma.messageTemplate.findMany()) }
  catch (e) { res.status(500).json({ error: e.message }) }
}

export const updateTemplate = async (req, res) => {
  try {
    const { id } = req.params
    const template = await prisma.messageTemplate.update({ where: { id }, data: req.body })
    res.json(template)
  } catch (e) { res.status(500).json({ error: e.message }) }
}
