import express from 'express'
import {
  getGuests,
  getGuest,
  createGuest,
  updateGuest,
  checkoutGuest,
} from '../controllers/guestsController.js'
import { verifyToken } from '../middleware/auth.js'

const router = express.Router()

router.use(verifyToken)

router.get('/', getGuests)
router.post('/', createGuest)
router.get('/:id', getGuest)
router.put('/:id', updateGuest)
router.post('/:id/checkout', checkoutGuest)

export default router
