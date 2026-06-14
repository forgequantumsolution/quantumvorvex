import express from 'express'
import { verifyToken, requireRole } from '../middleware/auth.js'
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

// Reads: any authenticated user (needed to populate the role dropdown / matrix).
router.get('/modules', getModules)
router.get('/', getRoles)

// Writes: owner-only (role management is restricted to owners).
router.post('/',      requireRole(['owner']), validate(schemas.createRole), createRole)
router.put('/:id',    requireRole(['owner']), validate(schemas.updateRole), updateRole)
router.delete('/:id', requireRole(['owner']), deleteRole)

export default router
