import express from 'express'
import { verifyToken, requirePermission } from '../middleware/auth.js'
import { sendReminder, getTemplates, createTemplate, updateTemplate } from '../controllers/remindersController.js'
const router = express.Router()
// Guest messaging is part of the Guests module.
router.use(verifyToken, requirePermission('guests'))
router.post('/send', sendReminder)
router.get('/templates', getTemplates)
router.post('/templates', createTemplate)
router.put('/templates/:id', updateTemplate)
export default router
