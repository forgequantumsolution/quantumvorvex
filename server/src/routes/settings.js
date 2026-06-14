import express from 'express'
import { getSettings, updateSettings, uploadLogo, upload } from '../controllers/settingsController.js'
import { verifyToken, requirePermission } from '../middleware/auth.js'

const router = express.Router()

router.use(verifyToken, requirePermission('settings'))

router.get('/', getSettings)
router.put('/', updateSettings)
router.post('/logo', upload.single('logo'), uploadLogo)

export default router
