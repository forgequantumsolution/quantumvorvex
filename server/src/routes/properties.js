import express from 'express'
import { verifyToken, requireOwner } from '../middleware/auth.js'
import { validate, schemas } from '../middleware/validate.js'
import {
  listProperties,
  getPortfolioSummary,
  createProperty,
  updateProperty,
  getPropertyMembers,
  setPropertyMember,
  removePropertyMember,
} from '../controllers/propertiesController.js'

const router = express.Router()

// Properties are organisation-level, so these routes don't run inside a single
// property's context (no requirePermission). Each handler scopes itself.
router.use(verifyToken)

// Any signed-in user: the properties they can open, and the portfolio overview.
router.get('/',        listProperties)
router.get('/summary', getPortfolioSummary)

// Owner-only: create / edit / archive properties and manage who has access (with
// the role each person holds at that property).
router.post('/',            requireOwner, validate(schemas.createProperty), createProperty)
router.put('/:id',          requireOwner, validate(schemas.updateProperty), updateProperty)
router.get('/:id/members',  requireOwner, getPropertyMembers)
router.put('/:id/members/:userId',    requireOwner, validate(schemas.setPropertyMember), setPropertyMember)
router.delete('/:id/members/:userId', requireOwner, removePropertyMember)

export default router
