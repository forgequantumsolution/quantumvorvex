import express from 'express'
import {
  getNotifications,
  dismissNotification,
  clearAll,
} from '../controllers/notificationsController.js'
import { verifyToken } from '../middleware/auth.js'

const router = express.Router()

router.use(verifyToken)

router.get('/', getNotifications)
router.put('/:id/dismiss', dismissNotification)
router.delete('/', clearAll)

export default router
