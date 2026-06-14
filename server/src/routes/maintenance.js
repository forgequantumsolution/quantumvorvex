import express from 'express'
import { verifyToken, requireMinRole } from '../middleware/auth.js'
import { validate, schemas } from '../middleware/validate.js'
import {
  getRequests,
  createRequest,
  updateRequest,
  addNote,
  deleteRequest,
  getSchedules,
  createSchedule,
} from '../controllers/maintenanceController.js'

const router = express.Router()

router.use(verifyToken)

// Preventive-maintenance schedule (static paths before /:id)
router.get('/schedule',  getSchedules)
router.post('/schedule', createSchedule)

router.get('/',           getRequests)
router.post('/',          validate(schemas.createMaintenanceRequest), createRequest)
router.put('/:id',        validate(schemas.updateMaintenanceRequest), updateRequest)
router.post('/:id/notes', validate(schemas.addMaintenanceNote), addNote)
router.delete('/:id',     requireMinRole('manager'), deleteRequest)

export default router
