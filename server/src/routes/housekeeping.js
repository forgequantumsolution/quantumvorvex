import express from 'express'
import { verifyToken } from '../middleware/auth.js'
import { getBoard, updateRoomStatus, getDailyList, getLinenTracker, markLinenChanged, submitInspection } from '../controllers/housekeepingController.js'
const router = express.Router()
router.get('/board', verifyToken, getBoard)
router.put('/:roomId/status', verifyToken, updateRoomStatus)
router.get('/daily', verifyToken, getDailyList)
router.get('/linen', verifyToken, getLinenTracker)
router.put('/linen/:roomId', verifyToken, markLinenChanged)
router.post('/inspection', verifyToken, submitInspection)
export default router
