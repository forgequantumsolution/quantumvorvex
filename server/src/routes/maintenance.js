import express from 'express'
import { verifyToken, requirePermission } from '../middleware/auth.js'
import { validate, schemas } from '../middleware/validate.js'
import {
  getRequests,
  createRequest,
  updateRequest,
  addNote,
  deleteRequest,
  getSchedules,
  createSchedule,
  getPublicRoom,
  createGuestRequest,
} from '../controllers/maintenanceController.js'

const router = express.Router()

// ── Public guest QR endpoints (NO auth) — must precede verifyToken ────────────
router.get('/public/room', getPublicRoom)
router.post('/public', validate(schemas.createGuestMaintenanceRequest), createGuestRequest)

router.use(verifyToken, requirePermission('maintenance'))

// Preventive-maintenance schedule (static paths before /:id)
router.get('/schedule',  getSchedules)
router.post('/schedule', createSchedule)

router.get('/',           getRequests)
router.post('/',          validate(schemas.createMaintenanceRequest), createRequest)
router.put('/:id',        validate(schemas.updateMaintenanceRequest), updateRequest)
router.post('/:id/notes', validate(schemas.addMaintenanceNote), addNote)
router.delete('/:id',     deleteRequest)

export default router
