import express from 'express'
import { getBookings, createBooking, updateBooking } from '../controllers/bookingsController.js'
import { verifyToken } from '../middleware/auth.js'

const router = express.Router()

router.use(verifyToken)

router.get('/', getBookings)
router.post('/', createBooking)
router.put('/:id', updateBooking)

export default router
