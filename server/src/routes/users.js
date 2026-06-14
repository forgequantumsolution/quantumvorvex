import express from 'express'
import { getUsers, createUser, updateUser, deleteUser } from '../controllers/usersController.js'
import { verifyToken, requirePermission } from '../middleware/auth.js'
import { validate, schemas } from '../middleware/validate.js'

const router = express.Router()

router.use(verifyToken, requirePermission('users'))

router.get('/',       getUsers)
router.post('/',      validate(schemas.createUser), createUser)
router.put('/:id',    validate(schemas.updateUser), updateUser)
router.delete('/:id', deleteUser)

export default router
