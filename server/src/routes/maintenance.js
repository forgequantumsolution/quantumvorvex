import express from 'express'
import { verifyToken } from '../middleware/auth.js'
import { getRequests, createRequest, updateRequest, addNote, getSchedules, createSchedule } from '../controllers/maintenanceController.js'
const router = express.Router()
router.get('/', verifyToken, getRequests)
router.post('/', verifyToken, createRequest)
router.put('/:id', verifyToken, updateRequest)
router.post('/:id/notes', verifyToken, addNote)
router.get('/schedule', verifyToken, getSchedules)
router.post('/schedule', verifyToken, createSchedule)
export default router
