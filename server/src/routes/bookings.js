import express from 'express'
import {
  getBookings,
  getBookingStats,
  getBooking,
  createBooking,
  createBookingGroup,
  getBedAvailability,
  getRentAccount,
  collectRent,
  updateBooking,
  confirmBooking,
  checkInBooking,
  checkOutBooking,
  cancelBooking,
  noShowBooking,
  deleteBooking,
  uploadBookingDocuments,
  getBookingInvoice,
  getNextInvoiceNo,
  lookupGuestByPhone,
  updateInvoiceNo,
  uploadDocs,
} from '../controllers/bookingsController.js'
import { verifyToken, requirePermission } from '../middleware/auth.js'
import { validate, schemas } from '../middleware/validate.js'

const router = express.Router()

router.use(verifyToken, requirePermission('bookings'))

router.get('/',      getBookings)
router.get('/stats', getBookingStats)
// Next auto invoice serial (preview for the create-booking form). Must precede /:id.
router.get('/next-invoice-no', getNextInvoiceNo)
// Returning-guest lookup by phone (create-booking form). Must precede /:id.
router.get('/guest-lookup', lookupGuestByPhone)
// Per-bed availability of a room let by bed (PG bed picker). Must precede /:id.
router.get('/bed-availability', getBedAvailability)
router.get('/:id',   getBooking)

// Tax invoice (HTML, print-ready) generated from a completed booking
router.get('/:id/invoice', getBookingInvoice)
// Override the tax-invoice serial number for a booking
router.patch('/:id/invoice-no', updateInvoiceNo)
router.post('/',   validate(schemas.createBooking), createBooking)
// Several occupants into one room let by bed — one booking per bed, linked by groupId.
router.post('/group', validate(schemas.createBookingGroup), createBookingGroup)
router.put('/:id', validate(schemas.updateBooking), updateBooking)

// ID-document uploads (multipart) — Aadhaar front/back, PAN, etc.
router.post('/:id/documents', uploadDocs.array('documents', 12), uploadBookingDocuments)

// Lifecycle actions
router.post('/:id/confirm',   confirmBooking)
router.post('/:id/check-in',  validate(schemas.checkInBooking),  checkInBooking)
router.post('/:id/check-out', validate(schemas.checkOutBooking), checkOutBooking)
router.post('/:id/cancel',    validate(schemas.cancelBooking),   cancelBooking)
router.post('/:id/no-show',   noShowBooking)

// Monthly tenancy: rent account + collect a month's rent on the booking
router.get('/:id/rent',           getRentAccount)
router.post('/:id/collect-rent',  collectRent)

// Hard delete — requires manage on bookings (RBAC-enforced at the router)
router.delete('/:id', deleteBooking)

export default router
