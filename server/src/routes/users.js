import express from 'express'
import { getUsers, createUser, updateUser, deleteUser } from '../controllers/usersController.js'
import { verifyToken, requireRole } from '../middleware/auth.js'
import { validate, schemas } from '../middleware/validate.js'

const router = express.Router()

router.get('/',       verifyToken, requireRole(['owner', 'manager']), getUsers)
router.post('/',      verifyToken, requireRole(['owner']), validate(schemas.createUser), createUser)
router.put('/:id',    verifyToken, requireRole(['owner']), validate(schemas.updateUser),  updateUser)
router.delete('/:id', verifyToken, requireRole(['owner']), deleteUser)

export default router
