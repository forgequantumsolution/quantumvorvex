import express from 'express'
import {
  getGuests,
  getGuestStats,
  getGuest,
  createGuest,
  updateGuest,
  deleteGuest,
  checkoutGuest,
  renewGuestStay,
  getGuestCommunications,
  createGuestCommunication,
  uploadGuestDocuments,
} from '../controllers/guestsController.js'
import { uploadDocs } from '../controllers/bookingsController.js'
import { verifyToken, requirePermission } from '../middleware/auth.js'

const router = express.Router()

router.use(verifyToken, requirePermission('guests'))

router.get('/', getGuests)
router.get('/stats', getGuestStats)
router.post('/', createGuest)
router.get('/:id', getGuest)
router.put('/:id', updateGuest)
router.delete('/:id', deleteGuest)
router.post('/:id/documents', uploadDocs.array('documents', 12), uploadGuestDocuments)
router.post('/:id/checkout', checkoutGuest)
router.post('/:id/renew', renewGuestStay)
router.get('/:id/communications', getGuestCommunications)
router.post('/:id/communications', createGuestCommunication)

export default router
