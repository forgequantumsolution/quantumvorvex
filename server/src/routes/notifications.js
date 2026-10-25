import express from 'express'
import {
  getNotifications,
  dismissNotification,
  clearAll,
} from '../controllers/notificationsController.js'
import { verifyToken, requireProperty } from '../middleware/auth.js'

const router = express.Router()

// Notifications belong to the current property; any member of it may see them.
router.use(verifyToken, requireProperty)

router.get('/', getNotifications)
router.put('/:id/dismiss', dismissNotification)
router.delete('/', clearAll)

export default router
