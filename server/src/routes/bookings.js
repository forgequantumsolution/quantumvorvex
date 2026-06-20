import express from 'express'
import {
  getBookings,
  getBookingStats,
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
  updateInvoiceNo,
  uploadDocs,
} from '../controllers/bookingsController.js'
import { verifyToken, requirePermission } from '../middleware/auth.js'
import { validate, schemas } from '../middleware/validate.js'

const router = express.Router()

router.use(verifyToken, requirePermission('bookings'))

router.get('/',      getBookings)
router.get('/stats', getBookingStats)
router.get('/:id',   getBooking)

// Tax invoice (HTML, print-ready) generated from a completed booking
router.get('/:id/invoice', getBookingInvoice)
// Override the tax-invoice serial number for a booking
router.patch('/:id/invoice-no', updateInvoiceNo)
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

// Hard delete — requires manage on bookings (RBAC-enforced at the router)
router.delete('/:id', deleteBooking)

export default router
