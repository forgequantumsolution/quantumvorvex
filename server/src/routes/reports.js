import express from 'express'
import {
  getDashboard,
  getRevenue,
  getGst,
  exportCsv,
  getOccupancy,
  exportPdf,
} from '../controllers/reportsController.js'
import { verifyToken } from '../middleware/auth.js'

const router = express.Router()

router.use(verifyToken)

router.get('/dashboard', getDashboard)
router.get('/revenue', getRevenue)
router.get('/gst', getGst)
router.get('/occupancy', getOccupancy)
router.get('/export/csv', exportCsv)
router.get('/export/pdf', exportPdf)

export default router
