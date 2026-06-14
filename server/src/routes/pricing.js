import express from 'express'
import { verifyToken } from '../middleware/auth.js'
import {
  getRules, saveRules, computeRate,
  getCompetitors, createCompetitor, updateCompetitor, deleteCompetitor,
} from '../controllers/pricingController.js'
const router = express.Router()
router.get('/rules', verifyToken, getRules)
router.put('/rules', verifyToken, saveRules)
router.post('/compute', verifyToken, computeRate)
// Competitor rate benchmarking
router.get('/competitors', verifyToken, getCompetitors)
router.post('/competitors', verifyToken, createCompetitor)
router.put('/competitors/:id', verifyToken, updateCompetitor)
router.delete('/competitors/:id', verifyToken, deleteCompetitor)
export default router
