import express from 'express'
import {
  getBookings,
  getBooking,
  createBooking,
  updateBooking,
  confirmBooking,
  checkInBooking,
  checkOutBooking,
  cancelBooking,
  noShowBooking,
  deleteBooking,
  uploadBookingDocuments,
  getBookingInvoice,
  uploadDocs,
} from '../controllers/bookingsController.js'
import { verifyToken, requireMinRole } from '../middleware/auth.js'
import { validate, schemas } from '../middleware/validate.js'

const router = express.Router()

router.use(verifyToken)

router.get('/',    getBookings)
router.get('/:id', getBooking)

// Tax invoice (HTML, print-ready) generated from a completed booking
router.get('/:id/invoice', getBookingInvoice)
router.post('/',   validate(schemas.createBooking), createBooking)
router.put('/:id', validate(schemas.updateBooking), updateBooking)

// ID-document uploads (multipart) — Aadhaar front/back, PAN, etc.
router.post('/:id/documents', uploadDocs.array('documents', 12), uploadBookingDocuments)

// Lifecycle actions
router.post('/:id/confirm',   confirmBooking)
router.post('/:id/check-in',  validate(schemas.checkInBooking),  checkInBooking)
router.post('/:id/check-out', validate(schemas.checkOutBooking), checkOutBooking)
router.post('/:id/cancel',    validate(schemas.cancelBooking),   cancelBooking)
router.post('/:id/no-show',   noShowBooking)

// Hard delete — managers and owners only
router.delete('/:id', requireMinRole('manager'), deleteBooking)

export default router
