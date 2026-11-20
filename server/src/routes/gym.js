import express from 'express'
import { verifyToken, requirePermission } from '../middleware/auth.js'
import { validate, schemas } from '../middleware/validate.js'
import {
  getDashboard, getMembers, getMember, createMember, updateMember, deleteMember,
  addMembership, freezeMembership, unfreezeMembership, cancelMembership, addPayment,
  getPlans, createPlan, updatePlan, deletePlan, getInHouseGuests,
  receiveMemberDocs, uploadMemberDocuments, getMemberDocumentFile, deleteMemberDocument,
  deleteMembership, deletePayment,
} from '../controllers/gymController.js'

const router = express.Router()

// Reads need VIEW, writes MANAGE (inferred from the method). Deleting a member
// and cancelling a plan are owner/admin only (checked in the controller).
router.use(verifyToken, requirePermission('gym'))

router.get('/dashboard',                  getDashboard)
router.get('/guests',                     getInHouseGuests)

router.get('/plans',                      getPlans)
router.post('/plans',                     validate(schemas.gymPlan), createPlan)
router.put('/plans/:id',                  validate(schemas.gymPlan), updatePlan)
router.delete('/plans/:id',               deletePlan)

router.get('/members',                    getMembers)
router.post('/members',                   validate(schemas.createGymMember), createMember)
router.get('/members/:id',                getMember)
router.put('/members/:id',                validate(schemas.updateGymMember), updateMember)
router.delete('/members/:id',             deleteMember)
router.post('/members/:id/documents',              receiveMemberDocs, uploadMemberDocuments)
router.get('/members/:id/documents/:docId',        getMemberDocumentFile)
router.delete('/members/:id/documents/:docId',     deleteMemberDocument)
router.post('/members/:id/memberships',   validate(schemas.createGymMembership), addMembership)

router.post('/memberships/:id/freeze',    freezeMembership)
router.post('/memberships/:id/unfreeze',  unfreezeMembership)
router.post('/memberships/:id/cancel',    cancelMembership)
router.post('/memberships/:id/payments',  validate(schemas.gymPayment), addPayment)
router.delete('/memberships/:id',         deleteMembership)
router.delete('/payments/:id',            deletePayment)

export default router
