import express from 'express'
import { verifyToken, requirePermission, requireOwner } from '../middleware/auth.js'
import { validate, schemas } from '../middleware/validate.js'
import {
  getRoles,
  getModules,
  createRole,
  updateRole,
  deleteRole,
} from '../controllers/rolesController.js'

const router = express.Router()

router.use(verifyToken)

// Reads: require View on the Users module (powers the role dropdown / matrix UI).
router.get('/modules', requirePermission('users', 'VIEW'), getModules)
router.get('/',        requirePermission('users', 'VIEW'), getRoles)

// Writes: owner-only (role management is restricted to owners).
router.post('/',      requireOwner, validate(schemas.createRole), createRole)
router.put('/:id',    requireOwner, validate(schemas.updateRole), updateRole)
router.delete('/:id', requireOwner, deleteRole)

export default router
