import express from 'express'
import { verifyToken, requirePermission } from '../middleware/auth.js'
import {
  getRules, saveRules, computeRate,
  getCompetitors, createCompetitor, updateCompetitor, deleteCompetitor,
} from '../controllers/pricingController.js'
const router = express.Router()
// Pricing config lives under the Settings module (Settings → Pricing Rules tab).
router.use(verifyToken, requirePermission('settings'))
router.get('/rules', getRules)
router.put('/rules', saveRules)
router.post('/compute', computeRate)
// Competitor rate benchmarking
router.get('/competitors', getCompetitors)
router.post('/competitors', createCompetitor)
router.put('/competitors/:id', updateCompetitor)
router.delete('/competitors/:id', deleteCompetitor)
export default router
