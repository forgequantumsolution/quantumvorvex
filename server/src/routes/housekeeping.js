import express from 'express'
import { verifyToken, requirePermission } from '../middleware/auth.js'
import { getBoard, updateRoomStatus, getDailyList, getLinenTracker, markLinenChanged, submitInspection } from '../controllers/housekeepingController.js'
const router = express.Router()
router.use(verifyToken, requirePermission('housekeeping'))
router.get('/board', getBoard)
router.put('/:roomId/status', updateRoomStatus)
router.get('/daily', getDailyList)
router.get('/linen', getLinenTracker)
router.put('/linen/:roomId', markLinenChanged)
router.post('/inspection', submitInspection)
export default router
