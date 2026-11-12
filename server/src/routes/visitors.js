import express from 'express'
import { verifyToken, requirePermission } from '../middleware/auth.js'
import { validate, schemas } from '../middleware/validate.js'
import {
  getVisitors, lookupVisitor, getVisitor, createVisitor, updateVisitor,
  checkInVisitor, rejectVisitor, checkOutVisitor, blockVisitor, unblockVisitor, deleteVisitor,
  getVisitorQr, regenerateVisitorQr, updateVisitorSettings,
} from '../controllers/visitorsController.js'

const router = express.Router()

// Reads need VIEW, writes MANAGE (inferred from the method). The public QR
// endpoints live in routes/public.js.
router.use(verifyToken, requirePermission('visitors'))

// Static paths before /:id
router.get('/lookup',           lookupVisitor)
router.get('/qr',               getVisitorQr)
router.post('/qr/regenerate',   regenerateVisitorQr)
router.put('/settings',         validate(schemas.visitorSettings), updateVisitorSettings)

router.get('/',                 getVisitors)
router.post('/',                validate(schemas.createVisitor), createVisitor)
router.get('/:id',              getVisitor)
router.put('/:id',              validate(schemas.updateVisitor), updateVisitor)
router.post('/:id/check-in',    checkInVisitor)
router.post('/:id/reject',      validate(schemas.rejectVisitor), rejectVisitor)
router.post('/:id/check-out',   checkOutVisitor)
router.post('/:id/block',       validate(schemas.blockVisitor), blockVisitor)
router.delete('/:id/block',     unblockVisitor)
router.delete('/:id',           deleteVisitor)

export default router
