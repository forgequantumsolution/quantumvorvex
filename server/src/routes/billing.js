import express from 'express'
import {
  getInvoices,
  getInvoiceStats,
  generateInvoice,
  billPgRent,
  collectPayment,
  getInvoicePdf,
  getLetterhead,
  getLedger,
  getCashRegister,
  deleteInvoice,
  shareInvoiceLink,
} from '../controllers/billingController.js'
import { verifyToken, requirePermission } from '../middleware/auth.js'

const router = express.Router()

// Sharing a link is a read (anyone who can view the invoice may send it), so it
// is registered before the router-wide guard, which would demand MANAGE for POST.
router.post('/:id/share-link', verifyToken, requirePermission('billing', 'VIEW'), shareInvoiceLink)

router.use(verifyToken, requirePermission('billing'))

router.get('/', getInvoices)
// Static paths before parameterized ones.
router.get('/stats', getInvoiceStats)
router.get('/ledger', getLedger)
router.get('/cash-register', getCashRegister)
router.get('/letterhead', getLetterhead)
router.post('/generate', generateInvoice)
// Bill PG rent that has fallen due now (the daily job does this automatically).
router.post('/pg-rent', billPgRent)
router.put('/:id/collect', collectPayment)
router.get('/:id/pdf', getInvoicePdf)
router.delete('/:id', deleteInvoice)

export default router
