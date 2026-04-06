import express from 'express'
import { getUsers, createUser, updateUser, deleteUser } from '../controllers/usersController.js'
import { verifyToken, requireRole } from '../middleware/auth.js'

const router = express.Router()

// All user management requires authentication + owner or manager role
router.get('/',      verifyToken, requireRole(['owner', 'manager']), getUsers)
router.post('/',     verifyToken, requireRole(['owner']),            createUser)
router.put('/:id',   verifyToken, requireRole(['owner']),            updateUser)
router.delete('/:id',verifyToken, requireRole(['owner']),            deleteUser)

export default router
