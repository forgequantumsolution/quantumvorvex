import express from 'express'
import { getRooms, createRoom, updateRoom, deleteRoom } from '../controllers/roomsController.js'
import { verifyToken, requirePermission } from '../middleware/auth.js'

const router = express.Router()

router.use(verifyToken, requirePermission('rooms'))

router.get('/', getRooms)
router.post('/', createRoom)
router.put('/:id', updateRoom)
router.delete('/:id', deleteRoom)

export default router
