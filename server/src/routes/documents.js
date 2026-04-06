import express from 'express'
import {
  getDocuments,
  uploadDocument,
  verifyDocument,
  upload,
} from '../controllers/documentsController.js'
import { verifyToken } from '../middleware/auth.js'

const router = express.Router()

router.use(verifyToken)

router.get('/', getDocuments)
router.post('/:guestId', upload.single('document'), uploadDocument)
router.put('/:id/verify', verifyDocument)

export default router
