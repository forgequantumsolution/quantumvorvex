import express from 'express'
import { verifyToken } from '../middleware/auth.js'
import { sendReminder, getTemplates, createTemplate, updateTemplate } from '../controllers/remindersController.js'
const router = express.Router()
router.post('/send', verifyToken, sendReminder)
router.get('/templates', verifyToken, getTemplates)
router.post('/templates', verifyToken, createTemplate)
router.put('/templates/:id', verifyToken, updateTemplate)
export default router
