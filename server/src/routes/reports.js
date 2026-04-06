import express from 'express'
import {
  getDashboard,
  getRevenue,
  getGst,
  exportCsv,
} from '../controllers/reportsController.js'
import { verifyToken } from '../middleware/auth.js'

const router = express.Router()

router.use(verifyToken)

router.get('/dashboard', getDashboard)
router.get('/revenue', getRevenue)
router.get('/gst', getGst)
router.get('/export/csv', exportCsv)

export default router
