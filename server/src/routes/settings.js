import express from 'express'
import { getSettings, updateSettings, uploadLogo, uploadStamp, upload } from '../controllers/settingsController.js'
import { verifyToken, requirePermission } from '../middleware/auth.js'

const router = express.Router()

router.use(verifyToken, requirePermission('settings'))

router.get('/', getSettings)
router.put('/', updateSettings)
router.post('/logo', upload.single('logo'), uploadLogo)
router.post('/stamp', upload.single('stamp'), uploadStamp)

export default router
