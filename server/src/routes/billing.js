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
} from '../controllers/billingController.js'
import { verifyToken, requirePermission } from '../middleware/auth.js'

const router = express.Router()

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
