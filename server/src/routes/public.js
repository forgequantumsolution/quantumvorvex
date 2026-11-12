import express from 'express'
import rateLimit from 'express-rate-limit'
import { getPublicInvoice } from '../controllers/billingController.js'
import { getPublicBookingInvoice } from '../controllers/bookingsController.js'
import { getPayPage, submitClaim } from '../controllers/paymentClaimsController.js'
import { validate, schemas } from '../middleware/validate.js'
import { getPublicVisitForm, submitPublicVisit, getPublicPass, publicCheckOut } from '../controllers/visitorsController.js'

// Public, no-login endpoints reached from links handed to guests. Each one is
// authorised by a signed token in the URL, never by a session.
const router = express.Router()

// A guest opening the invoice link sent to them on WhatsApp.
router.get('/invoice/:token', getPublicInvoice)
// …or a day booking's tax invoice (printable HTML; ?format=pdf for the PDF).
router.get('/booking-invoice/:token', getPublicBookingInvoice)

// Pay page for a booking (kind 'b') or billing invoice ('i'): amount due + the
// property's UPI QR, and the guest's "I've paid" report (UTR) for staff to confirm.
// Reports are tightly limited per IP: each one notifies staff.
const claimLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: process.env.NODE_ENV === 'production' ? 10 : 200,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again later.', code: 'ERR_RATE_LIMIT' },
})
router.get('/pay/:kind/:token', getPayPage)
router.post('/pay/:kind/:token/claim', claimLimiter, submitClaim)

// Visitor QR: the property's form (token = Property.visitorToken), and each
// visitor's own pass page (passToken), which they poll and sign out from.
const visitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: process.env.NODE_ENV === 'production' ? 20 : 300,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again later.', code: 'ERR_RATE_LIMIT' },
})
router.get('/visit/:token', getPublicVisitForm)
router.post('/visit/:token', visitLimiter, validate(schemas.publicVisitor), submitPublicVisit)
router.get('/pass/:passToken', getPublicPass)
router.post('/pass/:passToken/checkout', visitLimiter, publicCheckOut)

export default router
