import express from 'express'
import { verifyToken } from '../middleware/auth.js'
import { getRules, saveRules, computeRate } from '../controllers/pricingController.js'
const router = express.Router()
router.get('/rules', verifyToken, getRules)
router.put('/rules', verifyToken, saveRules)
router.post('/compute', verifyToken, computeRate)
export default router
