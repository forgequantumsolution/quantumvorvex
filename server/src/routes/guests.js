import express from 'express'
import {
  getGuests,
  getGuestStats,
  getGuest,
  createGuest,
  updateGuest,
  checkoutGuest,
  renewGuestStay,
  getGuestCommunications,
  createGuestCommunication,
} from '../controllers/guestsController.js'
import { verifyToken, requirePermission } from '../middleware/auth.js'

const router = express.Router()

router.use(verifyToken, requirePermission('guests'))

router.get('/', getGuests)
router.get('/stats', getGuestStats)
router.post('/', createGuest)
router.get('/:id', getGuest)
router.put('/:id', updateGuest)
router.post('/:id/checkout', checkoutGuest)
router.post('/:id/renew', renewGuestStay)
router.get('/:id/communications', getGuestCommunications)
router.post('/:id/communications', createGuestCommunication)

export default router
