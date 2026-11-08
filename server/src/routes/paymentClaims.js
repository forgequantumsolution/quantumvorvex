import express from 'express'
import { verifyToken, requirePermission } from '../middleware/auth.js'
import { listClaims, confirmClaim, rejectClaim } from '../controllers/paymentClaimsController.js'

// Guests' "I've paid by UPI" reports, for staff to confirm or reject.
const router = express.Router()

// Reads need billing VIEW, confirm/reject MANAGE (inferred from the method).
router.use(verifyToken, requirePermission('billing'))

router.get('/', listClaims)
router.post('/:id/confirm', confirmClaim)
router.post('/:id/reject', rejectClaim)

export default router
