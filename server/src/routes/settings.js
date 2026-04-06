import express from 'express'
import { getSettings, updateSettings, uploadLogo, upload } from '../controllers/settingsController.js'
import { verifyToken } from '../middleware/auth.js'

const router = express.Router()

router.use(verifyToken)

router.get('/', getSettings)
router.put('/', updateSettings)
router.post('/logo', upload.single('logo'), uploadLogo)

export default router
