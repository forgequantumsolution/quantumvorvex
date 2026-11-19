import express from 'express'
import { verifyToken, requirePermission } from '../middleware/auth.js'
import { validate, schemas } from '../middleware/validate.js'
import {
  getAssignees, getTickets, getTicket, createTicket, updateTicket, assignTicket, changeStatus,
  addComment, addChecklistItem, updateChecklistItem, deleteChecklistItem, deleteTicket,
} from '../controllers/ticketsController.js'

const router = express.Router()

// Reads need VIEW, writes MANAGE (inferred from the method). Who may do what
// on a given ticket (raiser / assignee / admin) is checked in the controller.
router.use(verifyToken, requirePermission('tickets'))

router.get('/assignees',                     getAssignees)
router.get('/',                              getTickets)
router.post('/',                             validate(schemas.createTicket), createTicket)
router.get('/:id',                           getTicket)
router.put('/:id',                           validate(schemas.updateTicket), updateTicket)
router.post('/:id/assign',                   validate(schemas.assignTicket), assignTicket)
router.post('/:id/status',                   validate(schemas.ticketStatus), changeStatus)
router.post('/:id/comments',                 validate(schemas.ticketComment), addComment)
router.post('/:id/checklist',                validate(schemas.ticketChecklistAdd), addChecklistItem)
router.put('/:id/checklist/:itemId',         validate(schemas.ticketChecklistUpdate), updateChecklistItem)
router.delete('/:id/checklist/:itemId',      deleteChecklistItem)
router.delete('/:id',                        deleteTicket)

export default router
