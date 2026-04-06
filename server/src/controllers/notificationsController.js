import prisma from '../utils/prisma.js'

// GET /notifications
export const getNotifications = async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { dismissed: false },
      orderBy: { createdAt: 'desc' },
    })
    return res.status(200).json({ notifications })
  } catch (err) {
    console.error('getNotifications error:', err)
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

// PUT /notifications/:id/dismiss
export const dismissNotification = async (req, res) => {
  try {
    const { id } = req.params

    const notification = await prisma.notification.update({
      where: { id },
      data: { dismissed: true },
    })

    return res.status(200).json({ notification })
  } catch (err) {
    console.error('dismissNotification error:', err)
    if (err.code === 'P2025') {
      return res.status(404).json({ message: 'Notification not found.' })
    }
    return res.status(500).json({ message: 'Internal server error.' })
  }
}

// DELETE /notifications
export const clearAll = async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { dismissed: false },
      data: { dismissed: true },
    })
    return res.status(200).json({ message: 'All notifications cleared.' })
  } catch (err) {
    console.error('clearAll error:', err)
    return res.status(500).json({ message: 'Internal server error.' })
  }
}
