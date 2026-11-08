import express from 'express'
import { getUsers, createUser, updateUser, setUserAccess, deleteUser } from '../controllers/usersController.js'
import { verifyToken, requirePermission, requireOwner } from '../middleware/auth.js'
import { validate, schemas } from '../middleware/validate.js'

const router = express.Router()

// Scoped to the current property: a property admin manages that property's team.
router.use(verifyToken, requirePermission('users'))

router.get('/',       getUsers)
router.post('/',      validate(schemas.createUser), createUser)
router.put('/:id',    validate(schemas.updateUser), updateUser)
// Owner-only: which properties a user can open, and their role at each.
router.put('/:id/access', requireOwner, validate(schemas.setUserAccess), setUserAccess)
router.delete('/:id', deleteUser)

export default router
