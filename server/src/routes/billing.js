import express from 'express'
import {
  getInvoices,
  getInvoiceStats,
  generateInvoice,
  collectPayment,
  getInvoicePdf,
  getLedger,
  getCashRegister,
} from '../controllers/billingController.js'
import { verifyToken, requirePermission } from '../middleware/auth.js'

const router = express.Router()

router.use(verifyToken, requirePermission('billing'))

router.get('/', getInvoices)
// Static paths before parameterized ones.
router.get('/stats', getInvoiceStats)
router.get('/ledger', getLedger)
router.get('/cash-register', getCashRegister)
router.post('/generate', generateInvoice)
router.put('/:id/collect', collectPayment)
router.get('/:id/pdf', getInvoicePdf)

export default router
