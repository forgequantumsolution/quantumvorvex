import express from 'express'
import {
  getSettings, updateSettings, uploadLogo, uploadStamp, upload,
  uploadQr, uploadUpiQr, deleteUpiQr, getLinkOrigin,
} from '../controllers/settingsController.js'
import { verifyToken, requirePermission } from '../middleware/auth.js'

const router = express.Router()

router.use(verifyToken, requirePermission('settings'))

router.get('/', getSettings)
router.put('/', updateSettings)
router.post('/logo', upload.single('logo'), uploadLogo)
router.post('/stamp', upload.single('stamp'), uploadStamp)
// Payment QR image (any single file field).
router.post('/upi-qr', uploadQr, uploadUpiQr)
router.delete('/upi-qr', deleteUpiQr)
// What guest links will look like (Settings preview).
router.get('/link-origin', getLinkOrigin)

export default router
