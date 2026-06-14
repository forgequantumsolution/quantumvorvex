import express from 'express'
import {
  getDocuments,
  uploadDocument,
  verifyDocument,
  upload,
} from '../controllers/documentsController.js'
import { verifyToken, requirePermission } from '../middleware/auth.js'

const router = express.Router()

router.use(verifyToken, requirePermission('documents'))

router.get('/', getDocuments)
router.post('/:guestId', upload.single('document'), uploadDocument)
router.put('/:id/verify', verifyDocument)

export default router
