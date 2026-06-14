import express from 'express'
import {
  getFoodPlans,
  createFoodPlan,
  updateFoodPlan,
  deleteFoodPlan,
  getFoodOrders,
} from '../controllers/foodController.js'
import { verifyToken, requirePermission } from '../middleware/auth.js'

const router = express.Router()

// IMPORTANT: this router is mounted at the bare '/api/v1' prefix (see app.js), so any
// router-level middleware here runs for EVERY /api/v1/* request that reaches it and would
// intercept routers mounted after it. Enforce per-route instead so non-food paths fall through.
const food = [verifyToken, requirePermission('food')]

// Food Plans routes
router.get('/food-plans', ...food, getFoodPlans)
router.post('/food-plans', ...food, createFoodPlan)
router.put('/food-plans/:id', ...food, updateFoodPlan)
router.delete('/food-plans/:id', ...food, deleteFoodPlan)

// Food Orders route
router.get('/food-orders', ...food, getFoodOrders)

export default router
